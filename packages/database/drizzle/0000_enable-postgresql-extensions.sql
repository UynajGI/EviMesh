-- Custom SQL migration file, put your code below! --
-- M3-02: install extensions required by the database-native model.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
