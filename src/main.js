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
var schemas = {};

try {
    cumulativeData = JSON.parse(fs.readFileSync(CUMULATIVE_DATA_PATH));
} catch (e) {}

function saveData() {
    mkdirp.sync(path.join("data"));

    fs.writeFileSync(CUMULATIVE_DATA_PATH, JSON.stringify(cumulativeData));
}

function loadSchema(schemaName) {
    var data = JSON.parse(fs.readFileSync(path.join("schemas", `${schemaName}.json`)));

    schemas[data.name] = data;
}

app.get("/api/telemetrics", function(request, response) {
    response.send({
        status: "ok",
        version: package.version,
        vernum: package.vernum
    });
});

app.post("/api/telemetrics/event/:name", function(request, response) {
    var schema = schemas[request.params["name"]];

    if (!schema) {
        response.status(404);

        response.send({
            status: "error",
            code: "unknownEventType",
            message: "The given name of the event type is unknown."
        });

        return;
    }

    cumulativeData.events ||= {};
    cumulativeData.events[schema.name] ||= {};

    var eventData = cumulativeData.events[schema.name];

    eventData.allCount ||= 0;
    eventData.allCount++;

    eventData.characteristics ||= {};

    schema.characteristics.forEach(function(characteristic) {
        eventData.characteristics[characteristic] ||= {};

        var characteristicData = eventData.characteristics[characteristic];
        var characteristicValue = request.query[characteristic] || "";

        characteristicData.counts ||= {};

        characteristicData.counts[characteristicValue] ||= 0;
        characteristicData.counts[characteristicValue]++;
    });

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

loadSchema("os_downloadIm");

app.listen(process.argv[2], function() {
    console.log(`LiveG Telemetrics started on port ${process.argv[2]}`);
});