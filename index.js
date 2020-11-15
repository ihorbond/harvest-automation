const chrome = require('chrome-cookies-secure')
const puppeteer = require('puppeteer')
const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const path = require('path')
const fs = require('fs')

if (!fs.existsSync('projects.json')) {
    console.error('projects.json not found!')
    process.exit(1)
}

const projects = require('./projects.json')

// console.log(projects)

const argv = yargs(hideBin(process.argv))
    .option('headless', {
        alias: 'h',
        type: 'boolean',
        description: 'Run Chrome headless',
        default: false,
        hidden: true // hide until fixed to work in headless
    })
    .option('profile', {
        alias: 'g',
        type: 'string',
        description: 'Google Chrome user profile',
        default: 'Profile 1'
    })
    .option('project', {
        alias: 'p',
        type: 'string',
        description: 'Project code',
        default: '012010',
        choices: Object.values(projects).map(p => p.code)
    })
    .option('task', {
        alias: 't',
        type: 'string',
        description: 'Task code. Choices vary by project',
        default: 'ALL',
        choices: [...new Set(Object.values(projects).map(p => Object.keys(p.tasks)).flat())]
    })
    .option('screenshot', {
        alias: 's',
        type: 'boolean',
        description: 'Take screenshot in the end',
        default: false
    })
    .option('url', {
        alias: 'u',
        type: 'string',
        description: 'Your Harvest url',
        default: 'https://gridunityinc.harvestapp.com/'
    })
    .option('path', {
        type: 'string',
        description: 'Relative or absolute path to save screenshots to',
        default: 'screenshots'
    })
    .help()
    .argv

const workHoursPerDay = 8
const isFriday = new Date().getDay() === 5
const url = argv.url
const profile = argv.profile
const headless = argv.headless
const defaultProjectKey = Object.keys(projects).find(k => k === argv.project) || 'AS'
const defaultProject = projects[defaultProjectKey]
const defaultTaskKey = Object.keys(defaultProject.tasks).find(k => k === argv.task) || 'ALL'
const shouldTakeScreenshot = argv.screenshot
const screenshotsPath = argv.path

// console.log('options:', url, screenshotsPath, profile, headless, defaultProjectKey, defaultTaskKey, shouldTakeScreenshot)

const getCookies = callback => {
    chrome.getCookies(url, 'puppeteer', function(err, cookies) {
        if (err) {
            console.error(err, 'error')
            return
        }
        // console.log(cookies, 'cookies')
        callback(cookies)
    }, profile)
}

const submitForm = async (page, project, task, duration = null) => {
    // console.log('submitForm', project, task, duration)
    const form = await page.$('form.form.day-entry-editor')
    await page.waitForTimeout(1000)
    await (await form.$('a.chosen-single')).click()
    const inputs = await form.$$('input.chosen-search-input')
    await inputs[0].type(project)
    await page.keyboard.press('Enter')
    await inputs[1].type(task)
    await page.keyboard.press('Enter')
    if (duration) {
        const durationInput = await form.$('input[name="hours"]')
        durationInput.type(duration.toString())
    }

    const submitBtn = await form.$('button[type="submit"]')
    await submitBtn.click()
}

const startBrowser = async cookies => {
    try {
        const browser = await puppeteer.launch({
            headless: headless,
            defaultViewport: null,
            args: ['--start-maximized']
        })
        const page = await browser.newPage()
    
        await page.setCookie(...cookies)
        await page.goto(url)
    
        const addEntryBtn = await page.waitForSelector('.button-new-time-entry.js-new-time-entry')
        await addEntryBtn.click()
        addEntryBtn.dispose()
    
        let duration = 0
        let calendar = await page.waitForSelector('div.calendar-events')
        await page.waitForTimeout(1000) // event buttons have an animation so appear with delay
        const events = await calendar.$$('button')
    
        if (events.length > 0) {
            const eventsCount = events.length
            for (let i = 0; i < eventsCount; i++) {
                calendar = await page.waitForSelector('div.calendar-events')
                const eventDurations = await calendar.$$('span.calendar-event-duration')
                duration += await eventDurations[i].evaluate(el => +el.textContent.match(/(\d+\.)?\d+/)[0])
                const eventBtns = await calendar.$$('button')
                await eventBtns[i].click()
    
                await submitForm(page, projects.ADMIN.name, projects.ADMIN.tasks.IM)
    
                await page.waitForSelector('form.form.day-entry-editor', { hidden: true })
                const addEntryBtn = await page.waitForSelector('.button-new-time-entry.js-new-time-entry')
                await addEntryBtn.click()
                await page.waitForSelector('div.calendar-events')
                await page.waitForTimeout(1000)
            }
    
            calendar = await page.waitForSelector('div.calendar-events') // refresh calendar handle
            await page.waitForTimeout(1000) // event buttons have an animation so appear with delay
        }
    
        const leftoverDuration = workHoursPerDay - duration
        await submitForm(page, defaultProject.name, defaultProject.tasks[defaultTaskKey], leftoverDuration)
        await page.waitForSelector('form.form.day-entry-editor', { hidden: true })
    
        if (isFriday) {
            const submitWeekBtn = await page.$('button.hui-button.submit-link.js-toggle-approve.js-primary-approval-button')
            await submitWeekBtn.click()
            const confirmSubmitBtn = await page.$('button.hui-button-primary.js-submit')
            await confirmSubmitBtn.click()
        }
        if (shouldTakeScreenshot) {
            const fileName = `harvester${new Date().getTime()}.png`
            const filePath = path.join(screenshotsPath, fileName)
            console.debug(`Screenshot will be taken. Path: ${filePath}`)
            await page.screenshot({
                path: filePath
            })
        }
    
        await browser.close()
    } catch(e) {
        console.error('Error occurred', e)
        process.exit(1)
    }
}

getCookies(startBrowser)