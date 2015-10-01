CREATE TABLE users
(
  user_id SERIAL PRIMARY KEY,
  login character varying(64),
  pass  character varying(64)
);

CREATE TABLE logs
(
  log_id SERIAL PRIMARY KEY,
  user_id integer REFERENCES users(user_id),
  utimestamp int,
  message character varying(512)
);