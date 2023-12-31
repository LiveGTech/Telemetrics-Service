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
const MAX_EVENT_POST_COUNT = 20;
const MIN_EVENT_POST_DURATION = 24 * 60 * 60 * 1000; // 1 day

var cumulativeData = {};
var schemas = {};
var requestIps = {};

try {
    cumulativeData = JSON.parse(fs.readFileSync(CUMULATIVE_DATA_PATH));
} catch (e) {}

mkdirp.sync(path.join("data"));
mkdirp.sync(path.join("data", "full"));

function saveData() {
    fs.writeFileSync(CUMULATIVE_DATA_PATH, JSON.stringify(cumulativeData));
}

function loadSchema(schemaName) {
    var schema = JSON.parse(fs.readFileSync(path.join("schemas", `${schemaName}.json`)));

    schemas[schema.name] = schema;

    var fullDataFilename = path.join("data", "full", `${schema.name}.tsv`);

    var header = [
        "_sentAt",
        ...schema.characteristics
    ].map((item) => String(item).replace(/\t/g, "")).join("\t");

    if (!fs.existsSync(fullDataFilename)) {
        fs.writeFileSync(fullDataFilename, header + "\n");

        console.log(`Full data file for schema \`${schema.name}\` created`);
    } else {
        var fullData = fs.readFileSync(fullDataFilename, "utf-8");
        var allRows = fullData.split("\n");
        var allNewRows = [];
        var currentHeader = allRows[0];
        var currentCharacteristics = currentHeader.split("\t");

        allRows.pop();

        if (currentHeader != header) {
            console.log(`Backfilling schema \`${schema.name}\`...`);

            allNewRows.push(header);

            for (var i = 1; i < allRows.length; i++) {
                var row = {};

                allRows[i].split("\t").forEach(function(field, j) {
                    row[currentCharacteristics[j]] = field;
                });

                allNewRows.push([
                    "_sentAt",
                    ...schema.characteristics
                ].map((item) => row[item] || "").join("\t"));
            }

            fs.writeFileSync(fullDataFilename, allNewRows.join("\n") + "\n");

            console.log(`Backfill has been performed to full data for schema \`${schema.name}\``);
        } else {
            console.log(`Full data for schema \`${schema.name}\` checked; conforms to current schema specifications`);
        }
    }
}

function setDefault(object, key, value) {
    if (!object[key]) {
        object[key] = value;
    }
}

app.use(function(request, response, next) {
    response.header("Access-Control-Allow-Origin", "*");

    next();
});

app.get("/api/telemetrics", function(request, response) {
    response.send({
        status: "ok",
        version: package.version,
        vernum: package.vernum
    });
});

app.post("/api/telemetrics/event/:name", function(request, response) {
    var ip = request.header("X-Request-IP");

    if (ip) {
        setDefault(requestIps, ip, {
            requests: []
        });

        requestIps[ip].requests = requestIps[ip].requests.filter(function(request) {
            if (Date.now() - request.sentAt > MIN_EVENT_POST_DURATION) {
                return false;
            }

            return true;
        });

        if (
            requestIps[ip] &&
            requestIps[ip].requests.length > MAX_EVENT_POST_COUNT &&
            Date.now() - requestIps[ip].requests[0].sentAt <= MIN_EVENT_POST_DURATION
        ) {
            response.status(429);

            response.send({
                status: "error",
                code: "limitReached",
                message: "The limit for the number of events that may be sent from this client has been reached. Please try again later."
            });

            return;
        }

        requestIps[ip].requests.push({
            sentAt: Date.now()
        });
    }

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

    setDefault(cumulativeData, "events", {});
    setDefault(cumulativeData.events, schema.name, {});

    var eventData = cumulativeData.events[schema.name];

    setDefault(eventData, "allCount", 0);

    eventData.allCount++;

    setDefault(eventData, "characteristics", {});

    var characteristicValues = [];
    var meetsRules = true;

    schema.characteristics.forEach(function(characteristic) {
        if (!schema.regexRules) {
            return;
        }

        var regexRule = schema.regexRules[characteristic] || schema.regexRules[""];

        if (!regexRule) {
            return;
        }

        if (!(request.query[characteristic] || "").match(new RegExp(regexRule))) {
            meetsRules = false;
        }
    });

    if (!meetsRules) {
        response.status(400);

        response.send({
            status: "error",
            code: "invalidFormat",
            message: "The format of the provided event data values is invalid."
        });

        return;
    }

    schema.characteristics.forEach(function(characteristic) {
        setDefault(eventData.characteristics, characteristic, {});

        var characteristicData = eventData.characteristics[characteristic];
        var characteristicValue = request.query[characteristic] || "";

        characteristicValues.push(characteristicValue);

        setDefault(characteristicData, "counts", {});
        setDefault(characteristicData.counts, characteristicValue, 0);

        characteristicData.counts[characteristicValue]++;
    });

    var fullDataFilename = path.join("data", "full", `${schema.name}.tsv`);

    fs.appendFileSync(fullDataFilename, [
        Date.now(),
        ...characteristicValues
    ].map((item) => String(item).replace(/\t/g, "")).join("\t") + "\n");

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