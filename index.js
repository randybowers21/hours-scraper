import "dotenv/config";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { DateTime } from "luxon";

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_KEY);

const ddDocumentType = "HTML";

const logsUrl =
  "https://hos.omnitracs.com/QHOS/View.aspx?ReportLocation=DriverLogExport";

const signinUrl = "https://services.omnitracs.com/portalWeb/jsp/login.jsp";

import puppeteer from "puppeteer";

(async () => {
  //FUNCTIONS
  //LOGIN TO OMNITRACS
  const login = async () => {
    console.log("Logging In To Omnitracs...");
    await page.goto(signinUrl, { waitUntil: "networkidle0" });
    await page.type("#companyName", process.env.OMNITRACS_COMPANY_NAME);
    await page.type("#userName", process.env.OMNITRACS_USERNAME);
    await page.type("#j_password", process.env.OMNITRACS_PASSWORD);
    await Promise.all([
      page.click("#loginButton"),
      page.waitForNavigation({ waitUntil: "networkidle0" }),
    ]);
  };
  //FETCH REPORT ON DRIVER
  const fetchReport = async (driver) => {
    console.log(`Generating Report for ${driver.code}`);
    await page.goto(logsUrl, { waitUntil: "networkidle0" });
    await page.reload({ waitUntil: "networkidle0" });

    const checkBox = await page.$("#rblDriverSelection_0");
    const driverInput = await page.$("#DrvSelectByID");
    const startDateInput = await page.$("#StartDate");
    const endDateInput = await page.$("#EndDate");
    const ddDocumentTypeInput = await page.$("#ddDocumentType");

    await checkBox.click();
    await driverInput.click({ clickCount: 3 });
    await driverInput.type(driver.code);
    await startDateInput.click({ clickCount: 3 });
    await startDateInput.type(StartDate);
    await endDateInput.click({ clickCount: 3 });
    await endDateInput.press("Backspace");
    await endDateInput.click({ clickCount: 3 });
    await endDateInput.type(EndDate);
    await ddDocumentTypeInput.select(ddDocumentType);
    await Promise.all([
      page.click("#btnViewReport"),
      page.waitForNavigation({ waitUntil: "networkidle0" }),
    ]);
    return await fetchHours(driver);
  };
  //FETCH DRIVER HOURS FROM REPORT
  const fetchHours = async (driver) => {
    if (driver.shift === "NIGHT") {
      return await getNightHours();
    }
    return await getDayHours();
  };

  const getDayHours = async () => {
    return await page.evaluate(() => {
      const dateTimes = [];
      const hours = [...document.querySelectorAll(".a81")];
      hours.map((hour) => {
        const time = hour.textContent;
        const date = time.split(" ");
        dateTimes.push(date);
      });
      finalTimes = [];
      dateTimes.map((dateTime, index) => {
        if (dateTime[1] === "00:00:00") {
          const startTime = dateTimes[index + 1];
          const endTime = dateTimes[index - 1];
          if (!startTime) {
            const endTime = dateTimes[index - 1];
            finalTimes.push(endTime);
            return;
          } else if (!endTime) {
            const startTime = dateTimes[index + 1];
            finalTimes.push(startTime);
            return;
          }
          finalTimes.push(startTime);
          finalTimes.push(endTime);
        }
      });
      if (finalTimes.length % 2 !== 0) {
        //ADD FINAL TIME IF WORKEDWEEK ENDS ON SATURDAY CURRENT LOGIC DOESNT
        finalTimes.push(dateTimes[dateTimes.length - 1]);
      }
      // console.log(finalTimes);
      return finalTimes;
    });
  };
  const getNightHours = async () => {
    return await page.evaluate(() => {
      const hours = [];
      const times = [...document.querySelectorAll(".a89c")];
      times.map((time) => {
        if (time.innerText > 36000) {
          const dateTime = time.parentElement
            .querySelector(".a81")
            .innerText.split(" ");
          if (dateTime[1] !== "00:00:00") {
            hours.push(dateTime);
          }

          if (
            time.parentElement.nextSibling &&
            time.parentElement.nextSibling
              .querySelector(".a81")
              .innerText.split(" ")[1] !== "00:00:00"
          ) {
            hours.push(
              time.parentElement.nextSibling
                .querySelector(".a81")
                .innerText.split(" ")
            );
          }
        }
      });
      console.log(hours);
      return hours;
    });
  };
  //CONVERT THE STRINGS OF TIMES FROM REPORT TO JAVASCRIPT DATES
  const convertTimesToDates = (hours) => {
    const convertedDates = [];
    hours.map((day) => {
      const date = day[0].split("/");
      const hours = day[1].split(":");
      const work = DateTime.fromObject({
        month: date[0],
        day: date[1],
        year: date[2],
        hour: hours[0],
        minute: hours[1],
      });
      convertedDates.push(work);
    });
    convertedDates.sort();
    return convertedDates;
  };
  //ADDS ZEROS TO MAKE TIME IN 24HR FORMAT FOR GOOGLESHEETS
  const addLeadingZeros = (str, targetLength) => {
    return str.padStart(targetLength, "0");
  };
  //CALCULATES PAY BASED ON HOURS WORKED
  const calculatePay = (minutesWorked, fleet) => {
    if (fleet == "DAILY") {
      if (minutesWorked > 0) {
        return 225.0;
      }
      return 0.0;
    }
    if (fleet == "CALIFORNIA") {
      if (minutesWorked === 0) {
        return 0.0;
      } else if (minutesWorked < 480) {
        return 160.0;
      } else if (minutesWorked >= 480 && minutesWorked < 660) {
        return 225.0;
      } else if (minutesWorked >= 660 && minutesWorked < 840) {
        return 275.0;
      }
      return 325.0;
    }
    if (fleet == "UTAH") {
      if (minutesWorked === 0) {
        return 0.0;
      } else if (minutesWorked < 480) {
        return 160.0;
      } else if (minutesWorked >= 480 && minutesWorked < 660) {
        return 205.0;
      } else if (minutesWorked >= 660 && minutesWorked < 840) {
        return 250.0;
      }
      return 275.0;
    }
  };
  //COMPILE ALL DATA TO ARRAY OF OBJECTS FOR VIEWING
  const createWeekObject = (dates, driver) => {
    const weekSummary = [];
    dates.map((date, index) => {
      const dailyTimes = {};
      if (index % 2 === 0) {
        const start = date;
        const end = dates[index + 1];
        const diff = end.diff(start, ["minutes"]);
        const startHours = addLeadingZeros(date.c.hour.toString(), 2);
        const startMinutes = addLeadingZeros(date.c.minute.toString(), 2);
        const endHours = addLeadingZeros(dates[index + 1].c.hour.toString(), 2);
        const endMinutes = addLeadingZeros(
          dates[index + 1].c.minute.toString(),
          2
        );
        dailyTimes.timeWorked = diff.toObject();
        if (dailyTimes.timeWorked.minutes === 1440) {
          dailyTimes.timeWorked.minutes = 0;
        }
        dailyTimes.start = `${startHours}${startMinutes}`;
        dailyTimes.end = `${endHours}${endMinutes}`;
        dailyTimes.pay = calculatePay(
          dailyTimes.timeWorked.minutes,
          driver.fleet
        );
        if (dailyTimes.timeWorked.minutes > 0) {
          weekSummary.push(dailyTimes);
        }
      }
    });
    return weekSummary;
  };
  //DOES THE MATH TO GET TOTALS AND AVERAGES
  const calculateWeekTotals = (arr) => {
    const pay = [];
    const time = [];
    arr.map((item) => {
      pay.push(item.pay);
      time.push(item.timeWorked.minutes);
    });
    const totalPay = pay.reduce((prev, curr) => prev + curr, 0);
    const totalTime = time.reduce((prev, curr) => prev + curr, 0);
    const days = time.filter((day) => day !== 0);
    const totalHours = Math.floor(totalTime / 60);
    const remainingMinutes = Math.floor(totalTime % 60);
    const daysWorked = days.length;
    const dailyAverageHours = totalTime / 60 / daysWorked;
    const dailyAveragePay = totalPay / daysWorked;
    const hourlyPay = totalPay / (totalTime / 60);
    const weekTotals = {
      daysWorked,
      time: {
        totalMinutesWorked: totalTime,
        totalHours,
        remainingMinutes,
        dailyAverageHours,
      },
      pay: {
        totalPay,
        dailyAveragePay,
        hourlyPay,
      },
    };
    return weekTotals;
  };
  //ADDS "TITLE" TO ARRAY TO EASILY IDENTIFY IN GOOGLESHEETS
  const addArrayInfo = (driver, arr) => {
    const info = {};
    info.name = driver.code;
    info.week = `${StartDate} - ${EndDate}`;
    info.totals = calculateWeekTotals(arr);
    arr.unshift(info);
    return arr;
  };
  //BREAKS UP WEEK ARRAY INTO READABLE ITEMS/ROWS FOR GOOGLE SHEETS
  const createRows = (summary, driver) => {
    console.log("Adding Data to GoogleSheets");
    const rows = [];
    summary.map((day, index) => {
      if (index === 0) {
        const row = {
          NAME: day.name,
          WEEK: day.week,
          FLEET: driver.fleet,
          DAYSWORKED: day.totals.daysWorked,
          TOTALHOURS: `${day.totals.time.totalHours}hrs ${day.totals.time.remainingMinutes}min`,
          DAILYHOURS: day.totals.time.dailyAverageHours,
          TOTALPAY: day.totals.pay.totalPay,
          DAILYPAY: day.totals.pay.dailyAveragePay,
          HOURLYPAY: day.totals.pay.hourlyPay,
        };
        rows.push(row);
      } else {
        const row = {
          start: day.start,
          end: day.end,
          minutes: day.timeWorked.minutes / 60,
          pay: day.pay,
        };
        rows.push(row);
      }
    });
    return rows;
  };

  const createAndAddSummary = async (driver) => {
    const weekHours = await fetchReport(driver);
    const convertedDates = convertTimesToDates(weekHours);
    const weekSummary = await createWeekObject(convertedDates, driver);
    const fullWeekSummary = addArrayInfo(driver, weekSummary);
    //ADDS ROWS TO GOOGLE SHEETS
    await hoursSheet.addRows(createRows(fullWeekSummary, driver));
  };
  //LOOP THROUGH DRIVERS AND ADD INFO FOR EACH
  const postInfo = async (testDrivers) => {
    for (const testDriver of testDrivers) {
      await createAndAddSummary(testDriver);
    }
  };

  //ACTUAL START OF THE PROGRAM
  //GOOGLEAUTH
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  });

  //START UP PUPPETEER CHROMIUM
  let launchOptions = { headless: false, args: ["--start-maximized"] };
  //ADD launchOptions AS ARGUMENT TO SEE BROWSER
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
  );

  const DRIVERS = [
    { code: "ZARGUICA", fleet: "CALIFORNIA", shift: "NIGHT" },
    { code: "ULLWILCA", fleet: "CALIFORNIA", shift: "NIGHT" },
    { code: "COLLENCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "GARJESCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "CORRANCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "IRVJONCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "RIOFELUT", fleet: "UTAH", shift: "DAY" },
    { code: "TRODOUCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "HANMARCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "MONVICCA", fleet: "CALIFORNIA", shift: "DAY" },
    { code: "JORAAR", fleet: "DAILY", shift: "DAY" },
    { code: "CARCORNV", fleet: "UTAH", shift: "DAY" },
    { code: "SUNSCOUT", fleet: "UTAH", shift: "DAY" },
    { code: "ROGSTENV", fleet: "DAILY", shift: "DAY" },
    { code: "UNZRICCA", fleet: "DAILY", shift: "DAY" },
    { code: "BROORSUT", fleet: "UTAH", shift: "DAY" },
    { code: "AUSJOHCO", fleet: "UTAH", shift: "DAY" },
  ];
  const StartDate = "04/10/2022";
  const EndDate = "04/16/2022";

  //LOADS UP GOOGLE SHEETS INFORMATION
  await doc.loadInfo();
  const hoursSheet = doc.sheetsByTitle["Test"];

  //LOGIN TO OMNITRACS
  await login();
  //lOOP ALL DRIVERS AND FIND REPORTS
  console.log(
    `Running Reports for ${DRIVERS.length} Drivers for the Week Starting ${StartDate}`
  );
  await postInfo(DRIVERS);

  console.log("Closing Browser");
  await browser.close();
})();
