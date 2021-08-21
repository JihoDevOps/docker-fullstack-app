GRANT ALL PRIVILEGES ON *.* TO root@'%' IDENTIFIED BY '1234';

DROP DATABASE IF EXISTS myapp;

CREATE DATABASE myapp;
USE myapp;

CREATE TABLE list (
    id INTEGER AUTO_INCREMENT,
    value TEXT,
    PRIMARY KEY (id)
);