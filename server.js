require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const chalk = require("chalk");
const _ = require("lodash");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const ejs = require("ejs");

const PORT = process.env.PORT || 3000;

let submittedData = [];

app.use(bodyParser.json());
app.use(cors());
app.set("view engine", "ejs");

app.use((req, res, next) => {
  let method = chalk.magenta(req.method);
  let route = chalk.blue(req.originalUrl);
  res.on("finish", function() {
    let code = chalk.yellow(this.statusCode);
    console.log(`${method} ${route} ${code}`);
  });

  next();
});

const fetchSheet = async () => {
  const { SHEET_ID, SHEET_RANGE, GOOGLE_API_KEY } = process.env;
  const sheetRes = await axios.get(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_RANGE}?key=${GOOGLE_API_KEY}`
  );
  return sheetRes.data.values.map(v => {
    return { id: v[0], name: v[1] };
  });
};

app.get("/", async (req, res) => {
  res.render("./index.ejs", {
    list: await fetchSheet()
  });
});

app.post("/submit", (req, res) => {
  let validatedSubmit = {};
  for (let [key, value] of Object.entries(req.body)) {
    const num = Number(value);
    if (!isNaN(num) && num > 0) {
      validatedSubmit[key] = num;
    }
  }

  let normalizedSubmit = {};
  let sum = 0;
  for (let [key, value] of Object.entries(validatedSubmit)) {
    sum += value;
  }
  for (let [key, value] of Object.entries(validatedSubmit)) {
    normalizedSubmit[key] = value / sum;
  }

  submittedData.push(normalizedSubmit);
  //   console.log(normalizedSubmit);
  res.send(`Submitted\nTotal submissions: ${submittedData.length}`);
});

app.post("/clear", (req, res) => {
  const len = submittedData.length;
  submittedData = [];
  res.send(`Cleared ${len} submissions`);
});

app.post("/pick", async (req, res) => {
  let summedSubmit = {};
  for (n of submittedData) {
    for (let [key, value] of Object.entries(n)) {
      if (summedSubmit[key] === undefined) {
        summedSubmit[key] = 0;
      }
      summedSubmit[key] += value;
    }
  }
  //   console.log("summedSubmit:", summedSubmit);

  let max = 0;
  for (let [key, value] of Object.entries(summedSubmit)) {
    max = Math.max(max, value);
  }
  //   console.log("max:", max);

  let maxedSubmitIdList = [];
  for (let [key, value] of Object.entries(summedSubmit)) {
    if (value === max) {
      maxedSubmitIdList.push(key);
    }
  }
  //   console.log("maxedSubmitIdList:", maxedSubmitIdList);

  const list = await fetchSheet();
  //   console.log(list);

  const picked =
    maxedSubmitIdList[Math.floor(Math.random() * maxedSubmitIdList.length)];
  const pickedName = picked ? list.find(l => l.id === picked).name : "";
  const len = submittedData.length;

  let allSum = 0;
  const allData = [];
  for (let [key, value] of Object.entries(summedSubmit)) {
    allSum += value;
  }
  for (let [key, value] of Object.entries(summedSubmit)) {
    allData.push({
      name: list.find(l => l.id === key).name,
      percentage: (value / allSum) * 100
    });
  }
  allData.sort((a, b) => (a.percentage < b.percentage ? 1 : -1));

  res.send(
    `Picked: ${pickedName}\nBased on ${len} submissions\nTop 5 choices:\n${allData
      .map(d => `${d.percentage.toFixed(2)}%\t${d.name}`)
      .slice(0, 5)
      .join("\n")}`
  );
});

app.use(express.static("public"));

app.listen(PORT, () =>
  console.log(`Foodspinner app listening on port ${PORT}`)
);
