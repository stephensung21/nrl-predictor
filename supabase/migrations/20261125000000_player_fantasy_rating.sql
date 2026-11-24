-- The players page ranks by fantasy points a game instead of the Model's plus-minus (pipeline/players.py):
-- plus-minus can't separate teammates, so its list was mostly a list of the best teams. fantasy_rating is
-- the season's NRL fantasy points a game, shrunk four games' worth towards the average at his position.
-- player_ratings keeps the plus-minus, shown as the Model's impact. Null until publish.py rewrites the rows.
alter table player_seasons add column fantasy_rating double precision;
