-- Runs once, when the Postgres volume is first initialised.
-- The test suite only ever connects to this database (enforced by assertTestDatabase).
CREATE DATABASE autotrust_test OWNER autotrust;
