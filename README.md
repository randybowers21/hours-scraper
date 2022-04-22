# Hours Scraper
An app that scrapes an hours of service website for hours worked by drivers during a specified time period.

**Features**
1. Searches hundreds of lines of html to find correct start and end times for each day of the week for the specified driver.
2. Add or remove Drivers from search in the index.js files DRIVERS object.
3. Change report dates parameters in the index.js file by changing StartDate and EndDate.
4. Calculates dates and time worked in minutes thanks to Luxon.
5. Sends all returned data to a working Google Sheet used at work.

## What I've Learned
My first real solo attempt at a scraper and with Puppeteer it was easy and cool to see it work.

This is a project that will help me at work weekly by auto calculating hours worked. Currently we have to manually find and enter each item into the google sheet. The process usually takes 1.5 hours or so and now the program can be run and complete in about 30 seconds to a minute.

I used Puppeteer for the first time and its really easy. The documentation was a little rough to get through but luckily Google and Stack Overflow came through with everything I searched and needed.

This was my first time configuring and using .env... Looks like it worked haha.

At the request of momentjs I used Luxon for the first time and it was just as intuitive and easy to use with good Docs.

Then I connect to Google API by myself for the first time and used a Google Spreadsheet library that made communication between the two go smooth.

A small thing I learned at the end here was how to use .gitignore as well. Usually Create React App does that for me. I learned the hard way when the file was too big to add to GitHub then I had to clear the git and retry because simply adding the item to .gitignore after the fact doesn't work.

## Technologies

- [Puppeteer](https://pptr.dev/)
- [Luxon](https://moment.github.io/luxon/#/)
- [Dotenv](https://www.npmjs.com/package/dotenv)
- [Google Spreadsheets](https://www.npmjs.com/package/google-spreadsheet)
- [Google API](https://console.developers.google.com/)
