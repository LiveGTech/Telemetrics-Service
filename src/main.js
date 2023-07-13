/*
    Telemetrics Service

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const fs = require("fs");
const path = require("path");
const express = require("express");
const mkdirp = require("mkdirp");

const package = require("../package.json");

var app = express();

const CUMULATIVE_DATA_PATH = path.join("data", "cumulative.json");

var cumulativeData = {};

try {
    cumulativeData = JSON.parse(fs.readFileSync(CUMULATIVE_DATA_PATH));
} catch (e) {}

function saveData() {
    mkdirp.sync(path.join("data"));

    fs.writeFileSync(CUMULATIVE_DATA_PATH, JSON.stringify(cumulativeData));
}

app.get("/api/telemetrics", function(request, response) {
    response.send({
        status: "ok",
        version: package.version
    });
});

app.post("/api/telemetrics/event", function(request, response) {
    saveData();

    response.send({
        status: "ok"
    });
});

app.use(function(request, response, next) {
    response.status(404);

    response.send({
        status: "error",
        code: "invalidEndpoint",
        message: "The endpoint requested is invalid."
    });
});

app.listen(process.argv[2], function() {
    console.log(`LiveG Telemetrics started on port ${process.argv[2]}`);
});