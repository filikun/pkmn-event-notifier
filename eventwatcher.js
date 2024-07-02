require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const { WebhookClient } = require('discord.js');
const cheerio = require('cheerio');

const EVENT_WEBHOOK_URL = process.env.EVENT_WEBHOOK_URL.split(',');
const RAID_WEBHOOK_URL = process.env.RAID_WEBHOOK_URL.split(',');
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 300000;

const EVENT_NOTIFIED_FILE = './logs/notified_events.txt';
const EVENT_LOCAL_JSON_FILE = './events.json';
const EVENT_JSON_URL = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json';

const RAID_DATA_FILE = './raid_data.json';
const RAID_JSON_URL = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json';

let notifiedEvents = new Set();
let previousRaidData = [];

function loadNotifiedEvents() {
    try {
        if (fs.existsSync(EVENT_NOTIFIED_FILE)) {
            const data = fs.readFileSync(EVENT_NOTIFIED_FILE, 'utf8');
            notifiedEvents = new Set(data.trim().split('\n'));
        }
    } catch (error) {
        console.error('Error loading notified events:', error);
    }
}

function saveNotifiedEvents() {
    const data = Array.from(notifiedEvents).join('\n');
    fs.writeFileSync(EVENT_NOTIFIED_FILE, data, 'utf8');
}

function loadPreviousRaidData() {
    try {
        if (fs.existsSync(RAID_DATA_FILE)) {
            const data = fs.readFileSync(RAID_DATA_FILE, 'utf8');
            previousRaidData = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading previous raid data:', error);
    }
}

function saveRaidData(data) {
    fs.writeFileSync(RAID_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendToDiscord(webhookUrls, payload) {
    webhookUrls.forEach((url) => {
        const webhookClient = new WebhookClient({ url });
        webhookClient.send(payload)
            .catch((error) => {
                console.error('Error sending message to Discord:', error);
            });
    });
}

async function fetchEventData() {
    try {
        const response = await fetch(EVENT_JSON_URL);
        const remoteData = await response.json();
        fs.writeFileSync(EVENT_LOCAL_JSON_FILE, JSON.stringify(remoteData, null, 2), 'utf8');
        return remoteData;
    } catch (error) {
        console.error('Error fetching event data:', error);
        return null;
    }
}

async function fetchRaidData() {
    try {
        const response = await fetch(RAID_JSON_URL);
        const currentRaidData = await response.json();
        return currentRaidData;
    } catch (error) {
        console.error('Error fetching raid data:', error);
        return null;
    }
}

function getCurrentTime() {
    return new Date().getTime();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
    });
}

async function fetchDescriptionFromLink(link) {
    try {
        const response = await fetch(link);
        const html = await response.text();
        const $ = cheerio.load(html);
        const eventDescription = $('.event-description').text().trim();
        const formattedDescription = await formatEventDescription(eventDescription);
        return formattedDescription;
    } catch (error) {
        console.error('Error fetching event description:', error);
        return 'No description provided';
    }
}

async function formatEventDescription(description) {
    const lines = description.split('\n');
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        const indentation = lines[i].length - currentLine.length;
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

        let bulletPoint = '';

        if (indentation > 2) {
            bulletPoint = '* ';
            formattedLines.push(bulletPoint + currentLine);
        } else if (currentLine) {
            formattedLines.push(bulletPoint + currentLine);
        }

        if (nextLine === '' && currentLine && i < lines.length - 1) {
            formattedLines.push('');
        }
    }

    const formattedDescription = formattedLines.join('\n');
    return formattedDescription;
}

async function sendEventNotification(event) {
    const bonusesArray = [];
    if (event.extraData && event.extraData.communityday && event.extraData.communityday.bonuses) {
        for (const bonus of event.extraData.communityday.bonuses) {
            bonusesArray.push(bonus.text);
        }
    }

    const bonusesText = bonusesArray.length > 0 ? bonusesArray.join('\n') : 'No bonuses available';

    const embed = {
        title: event.name,
        url: event.link,
        description: event.description,
        fields: [
            { name: 'Type', value: event.heading },
            { name: 'Start Time', value: formatDate(event.start) },
            { name: 'End Time', value: formatDate(event.end) },
        ],
        image: {
            url: event.image,
        },
        author: {
            name: 'Pokémon Go',
            icon_url: 'https://lh3.googleusercontent.com/Uzo_GQXZXc1Nsj7OY3dbfRDam0TjTzV4A1dhgSYLzkdrygVRDZgDMv7JME4kEAkS0UFa0MdJevzXynIlc7X6yXRSEV2-XkrRpX1QzJts9-a6=e365-s0',
        },
        footer: {
            text: 'Fetched from Leek Duck using ScrapedDuck',
        },
        color: 0xFF5733,
    };

    if (bonusesText !== 'No bonuses available') {
        embed.fields.push({ name: 'Bonuses', value: bonusesText });
    }

    const payload = {
        embeds: [embed],
    };

    console.log("Sending Event: %s", event.heading);
    sendToDiscord(EVENT_WEBHOOK_URL, payload);
}

async function sendRaidNotification(raidData) {
    const tier1Raids = raidData.filter(raid => raid.tier === 'Tier 1');
    const tier3Raids = raidData.filter(raid => raid.tier === 'Tier 3');
    const tier5Raids = raidData.filter(raid => raid.tier === 'Tier 5');
    const megaRaids = raidData.filter(raid => raid.tier === 'Mega');

    const formatTierRaids = (raids) => {
        return raids.map(raid => `${raid.name}${raid.canBeShiny ? ' ✨' : ''}`).join('\n');
    };

    const formatDetailedRaids = (raids) => {
        return raids.map(raid => `
            **${raid.name}${raid.canBeShiny ? ' ✨' : ''}**
            Types: ${raid.types.map(type => type.name).join(', ')}
            CP (Normal): ${raid.combatPower.normal.min} - ${raid.combatPower.normal.max}
            CP (Boosted): ${raid.combatPower.boosted.min} - ${raid.combatPower.boosted.max}
            Boosted Weather: ${raid.boostedWeather.map(weather => weather.name).join(', ')}
        `).join('\n\n');
    };

    const embed = {
        title: 'New Raid Bosses',
        fields: [
            { name: '**Tier 1**', value: formatTierRaids(tier1Raids) || 'No Tier 1 raids', inline: false },
            { name: '**Tier 3**', value: formatTierRaids(tier3Raids) || 'No Tier 3 raids', inline: false },
            { name: '**Tier 5**', value: formatDetailedRaids(tier5Raids) || 'No Tier 5 raids', inline: false },
            { name: '**Mega Raids**', value: formatDetailedRaids(megaRaids) || 'No Mega raids', inline: false },
        ],
        image: {
            url: megaRaids.length > 0 ? megaRaids[0].image : '',
        },
        footer: {
            text: 'Fetched from Leek Duck using ScrapedDuck',
        },
        color: 0xFF5733,
    };

    const payload = {
        embeds: [embed],
    };

    console.log("Sending Raid Notification");
    sendToDiscord(RAID_WEBHOOK_URL, payload);
}

function hasRaidDataChanged(currentData, previousData) {
    return JSON.stringify(currentData) !== JSON.stringify(previousData);
}

async function checkAndSendEvents() {
    console.log('Checking for events...');
    const eventData = await fetchEventData();
    if (!eventData) return;

    const currentTime = getCurrentTime();
    const currentHour = Math.floor(currentTime / CHECK_INTERVAL);

    for (const event of eventData) {
        const startHour = Math.floor(new Date(event.start).getTime() / CHECK_INTERVAL);
        const endHour = Math.floor(new Date(event.end).getTime() / CHECK_INTERVAL);

        if (!notifiedEvents.has(event.name) && (startHour === currentHour || (startHour < currentHour && currentHour < endHour))) {
            notifiedEvents.add(event.name);
            const description = await fetchDescriptionFromLink(event.link);
            await sendEventNotification({ ...event, description });
        }
    }
    saveNotifiedEvents();
}

async function checkAndNotifyRaids() {
    console.log('Checking for raid data updates...');
    const currentRaidData = await fetchRaidData();
    if (!currentRaidData) return;

    if (!hasRaidDataChanged(currentRaidData, previousRaidData)) {
        console.log('No changes in raid data.');
        return;
    }

    console.log('Raid data has changed, sending notification...');
    saveRaidData(currentRaidData);
    previousRaidData = currentRaidData;
    await sendRaidNotification(currentRaidData);
}

function scheduleCheck() {
    loadNotifiedEvents();
    loadPreviousRaidData();
    checkAndSendEvents();
    checkAndNotifyRaids();
    setInterval(() => {
        checkAndSendEvents();
        checkAndNotifyRaids();
    }, CHECK_INTERVAL);
}

scheduleCheck();
