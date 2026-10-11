"""
An encrypted backup of the tipping comp: the only data in the database that can't be rebuilt from the
repo (PLAN_WEB.md step 7). The free Supabase plan has no backups you can download.

Exports the tippers' sign-in records (id and email only), profiles, tips, rounds and invites as JSON,
compressed and encrypted with AES-256-GCM under a key derived from BACKUP_PASSPHRASE (scrypt). The
Monday workflow saves the file as a workflow artifact for 90 days; the repo is public and so are its
artifacts, which is why the file is encrypted. Keep the passphrase somewhere other than GitHub too:
without it a backup can't be read.

Restoring upserts every row back (sign-in records first, then profiles, rounds, invites and tips), so
it can rebuild an empty project after `supabase db push` and `publish.py --backfill`, or put back
rows lost by mistake. Run it against the database it should change, deliberately.

Usage:
    python pipeline/backup.py --out backups/            # needs SUPABASE_DB_URL and BACKUP_PASSPHRASE
    python pipeline/backup.py --decrypt FILE            # print the JSON
    python pipeline/backup.py --restore FILE            # write it back into SUPABASE_DB_URL's database
"""

import argparse
import gzip
import json
import os
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import psycopg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

from publish import env

MAGIC = b"NRLTIPS1"  # file format: MAGIC, 16-byte salt, 12-byte nonce, AES-GCM ciphertext
# What's saved and restored, in restore order (foreign keys), with each table's key.
TABLES = [
    ("auth.users", "select id, email from auth.users order by id", ["id"]),
    ("profiles", "select * from profiles order by id", ["id"]),
    ("rounds", "select * from rounds order by season, round", ["season", "round"]),
    ("invites", "select * from invites order by created_at, code", ["code"]),
    ("tips", "select * from tips order by user_id, match_id", ["user_id", "match_id"]),
]


def key(passphrase, salt):
    return Scrypt(salt=salt, length=32, n=2 ** 15, r=8, p=1).derive(passphrase.encode())


def encrypt(data, passphrase):
    salt, nonce = os.urandom(16), os.urandom(12)
    return MAGIC + salt + nonce + AESGCM(key(passphrase, salt)).encrypt(nonce, gzip.compress(data), MAGIC)


def decrypt(blob, passphrase):
    if not blob.startswith(MAGIC):
        raise ValueError("not a tipping backup")
    salt, nonce, body = blob[8:24], blob[24:36], blob[36:]
    return gzip.decompress(AESGCM(key(passphrase, salt)).decrypt(nonce, body, MAGIC))


def plain(v):
    """A value JSON can hold: times as ISO text, ids as text."""
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return str(v) if isinstance(v, uuid.UUID) else v


def export(conn):
    """Every row of the tipping tables, as JSON-ready dicts."""
    out = {"exported_at": datetime.now().astimezone().isoformat(), "tables": {}}
    for table, sql, _ in TABLES:
        cur = conn.execute(sql)
        cols = [c.name for c in cur.description]
        out["tables"][table] = [{c: plain(v) for c, v in zip(cols, row)} for row in cur.fetchall()]
    return out


def restore(conn, backup):
    """Upsert every saved row back, in an order the foreign keys allow. Returns rows per table."""
    counts = {}
    with conn.transaction(), conn.cursor() as cur:
        for table, _, key_cols in TABLES:
            rows = backup["tables"].get(table, [])
            if not rows:
                counts[table] = 0
                continue
            cols = list(rows[0])
            updates = ", ".join(f"{c} = excluded.{c}" for c in cols if c not in key_cols)
            sql = (f"insert into {table} ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) "
                   f"on conflict ({', '.join(key_cols)}) do " + (f"update set {updates}" if updates else "nothing"))
            # The tips trigger stamps updated_at with now(); restoring keeps the saved time.
            if table == "tips":
                cur.execute("alter table tips disable trigger tips_check")
            cur.executemany(sql, [tuple(r[c] for c in cols) for r in rows])
            if table == "tips":
                cur.execute("alter table tips enable trigger tips_check")
            counts[table] = len(rows)
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    what = parser.add_mutually_exclusive_group(required=True)
    what.add_argument("--out", type=Path, help="directory to write the encrypted backup to")
    what.add_argument("--decrypt", type=Path, metavar="FILE")
    what.add_argument("--restore", type=Path, metavar="FILE")
    args = parser.parse_args()
    passphrase = env("BACKUP_PASSPHRASE")
    if not passphrase:
        print("backup: skipped (no BACKUP_PASSPHRASE)")
        return
    if args.decrypt:
        print(decrypt(args.decrypt.read_bytes(), passphrase).decode())
        return
    url = env("SUPABASE_DB_URL")
    if not url:
        print("backup: skipped (no SUPABASE_DB_URL)")
        return
    with psycopg.connect(url, prepare_threshold=None) as conn:
        if args.restore:
            backup = json.loads(decrypt(args.restore.read_bytes(), passphrase))
            print(f"restored: {restore(conn, backup)}")
            return
        backup = export(conn)
    args.out.mkdir(parents=True, exist_ok=True)
    name = args.out / f"tipping-{pd.Timestamp.now(tz='UTC'):%Y%m%dT%H%M%SZ}.bin"
    name.write_bytes(encrypt(json.dumps(backup).encode(), passphrase))
    print(f"backup: {name} ({', '.join(f'{t} {len(r)}' for t, r in backup['tables'].items())})")


if __name__ == "__main__":
    try:
        main()
    except psycopg.Error as ex:
        print(f"backup FAILED: {type(ex).__name__}: {str(ex).splitlines()[0] if str(ex) else ''}", file=sys.stderr)
        sys.exit(1)
