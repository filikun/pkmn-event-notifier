### Originally forked from acocalypso/Eventwatcher-Standalone but heavily modified. Fetching from [Leek Duck](https://leekduck.com/) using [ScrapeDuck](https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json).

# Pokémon Go Event Notifier

This project tracks Pokémon Go events, raids, and eggs, and sends notifications to specified Discord webhooks.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)

## Features

- Tracks Pokémon Go events, raids, and eggs.
- Sends notifications to Discord webhooks.
- Customizable via environment variables.
- Supports scheduling checks via cron syntax.

## Prerequisites

- Docker
- Docker Compose

## Installation

### Pull the Docker Image

If you want to use the pre-built Docker image from the GitHub Container Registry:
```
sh
docker pull ghcr.io/filikun/pkmn-event-notifier:latest
```
### Configure the Docker Compose File
```
version: '3.5'
services:
  pkmn-event-notifier:
    image: ghcr.io/filikun/pkmn-event-notifier:latest
    container_name: pkmn-event-notifier
    environment:
      - DISCORD_ROLE_ID=your_discord_role_id
      - EVENT_WEBHOOK_URL=https://discord.com/api/webhooks/your_event_webhook_url
      - RAID_WEBHOOK_URL=https://discord.com/api/webhooks/your_raid_webhook_url
      - EGG_WEBHOOK_URL=https://discord.com/api/webhooks/your_egg_webhook_url
      - CRON_SCHEDULE=0 6-22 * * *
    restart: always
    volumes:
      - /opt/pkmn-event-notifier/.env:/usr/src/app/.env
      - /etc/localtime:/etc/localtime:ro
      - /opt/pkmn-event-notifier/logs/:/usr/src/app/logs
    security_opt:
      - no-new-privileges:true
```
## Configuration

### Environment Variables
- `DISCORD_ROLE_ID`: The Discord role ID to mention in notifications.
- `EVENT_WEBHOOK_URL`: The webhook URL for event notifications.
- `RAID_WEBHOOK_URL`: The webhook URL for raid notifications.
- `EGG_WEBHOOK_URL`: The webhook URL for egg notifications.
- `CRON_SCHEDULE`: The cron schedule for checking events, raids, and eggs.

###Volumes
- `/opt/pkmn-event-notifier/.env`: Environment variables file.
- `/etc/localtime`: Timezone configuration.
- `/opt/pkmn-event-notifier/logs/`: Logs directory.


## Usage

Once deployed, the container will run according to the specified cron schedule, checking for updates and sending notifications to the configured Discord webhooks.


###  Fetching from [Leek Duck](https://leekduck.com/) using [ScrapeDuck](https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json).
