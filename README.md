[![Toolbox](https://img.shields.io/badge/Tera--Toolbox-latest-blueviolet)](https://github.com/tera-toolbox) ![](https://img.shields.io/github/license/SaltyMonkey/party-deaths-notifier)

# Moongourd Spy

TERA Toolbox module for gathering stats about player DPS from Moongourd without leaving Tera Online.

## Features

- Customizable (you can edit auto inspect dungeons list in settings and request mode)
- Manual inspect command
- Optional auto inspect mode (enabled by default)

## Settings

keepContinentsSequence - if `true` then moongourd spy will preserve sequence of dungeons when doing requests (slower but more organized output), false - faster but data can be displayed not in defined sequence. Default: false.

autoCheckAtInspect - enable/disable automatic check by every inspect event in game.

## Commands

/8 ms - enable/disable autoinspect

/8 ms i <name> - manually inspect user by username

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
