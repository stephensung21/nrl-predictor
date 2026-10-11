-- The Perth Bears join the NRL in 2027 (PLAN_WEB.md, notes 5). Their name matches src/ingest.py
-- (TEAM_STATE) and web/lib/teams.ts. If nrl.com lists them under another nickname, change all three.
insert into teams (name, full_name, state) values ('Bears', 'Perth Bears', 'WA');
