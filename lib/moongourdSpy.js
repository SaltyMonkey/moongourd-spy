"use strict";

const fetch = require("node-fetch");
const { start } = require("repl");
const url = require('url').URL;

const THROTTLE_REPEAT_DURATION = 500;

module.exports = function MoongourdParser(mod) {
	let throttleList = new Map();

	const secsToMinsString = (secs) => {
		return `${(secs / 60).toFixed(2)}mins`
	};

	const damageToMsString = (val) => {
		return `${(val / 1000000).toFixed(2)}M/s`
	};

	const getExpectedString = (avg, expected) => {
		let tmp = Number.parseFloat(expected)
		
		if(Number.isNaN(tmp) || tmp < 0) return "";

		return avg >= expected ? "Good" : "Bad";
	};

	const getLink = (serverId, playerName, continent, boss) => {
		let region = "EU";
		switch (serverId) {
			case (43):
			case (42): region = "NA"; break;
		}
		return `https://moongourd.com/api/mg/search.php?region=${region}&zone=${continent}&boss=${boss}&ver=1&name=${playerName}&page=1`
	};

	const requestData = async (link) => {
		const requestPayload = await fetch(link);
		if (!requestPayload.ok) return null;
		else {
			let res = null;
			try { res = await requestPayload.json(); }
			catch (e) { }
			return res;
		}
	};

	const correctNamesBecauseTeriIsSoBadInDev = (str) => {
		return str.replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16)));

	};

	const cutData = (payload, charName) => {
		let sanitizedPayload = payload[1];
		let grouped = {};

		//group data by log id to ensure everything will be presented without clones
		for (let i = 0; i < sanitizedPayload.length; i++) {
			sanitizedPayload[i].playerName = correctNamesBecauseTeriIsSoBadInDev(sanitizedPayload[i].playerName);

			if (!grouped[sanitizedPayload[i].logId]) grouped[sanitizedPayload[i].logId] = {};

			let customData = {};
			if (sanitizedPayload[i].fightDuration) customData.fightDuration = sanitizedPayload[i].fightDuration;
			if (sanitizedPayload[i].partyDps) customData.partyDps = sanitizedPayload[i].partyDps;
			if (sanitizedPayload[i].timestamp) customData.timestamp = sanitizedPayload[i].timestamp;

			if (sanitizedPayload[i].playerName === charName) {
				customData.playerDps = sanitizedPayload[i].playerDps;
			}

			grouped[sanitizedPayload[i].logId] = Object.assign(grouped[sanitizedPayload[i].logId], customData);
		}

		return grouped;
	}

	const analyzeRuns = (grouped, expectedDps) => {
		let vals = Object.values(grouped);

		const durations = vals.map(x => x.fightDuration);
		const partyDps = vals.map(x => x.partyDps);
		const playerDps = vals.map(x => x.playerDps);
		const playerAvgDps = playerDps.reduce((a, b) => (a + b)) / playerDps.length;

		return {
			"playerDpsAvg": damageToMsString(playerAvgDps),
			"status": getExpectedString(playerAvgDps, expectedDps),
			"durationMin": secsToMinsString(Math.min(...durations)),
			"durationMax": secsToMinsString(Math.max(...durations)),
			"partyDpsMin": damageToMsString(Math.min(...partyDps)),
			"partyDpsMax": damageToMsString(Math.max(...partyDps)),
			"playerDpsMin": damageToMsString(Math.min(...playerDps)),
			"playerDpsMax": damageToMsString(Math.max(...playerDps))
		}
	};

	const sendOutput = (charName, dungeonName, res) => {
		if (mod.settings.simplifiedOutput) {
			mod.command.message(`${dungeonName}| Min=${res.playerDpsMin} Avg=${res.playerDpsAvg} Max=${res.playerDpsMax}| ${res.status}`);
		}
		else {
			mod.command.message(`Highlight ${charName} in ${dungeonName} (latest 25 runs):`)
			mod.command.message(`- Player: Min=${res.playerDpsMin} Avg=${res.playerDpsAvg} Max=${res.playerDpsMax} ${res.status}`);
			mod.command.message(`- Party: Min=${res.partyDpsMin} Max=${res.partyDpsMax}`);
			mod.command.message(`- Runs durations: Min=${res.durationMin} Max=${res.durationMax}`);
		}
	};

	const analyzeChar = async (charName, continentId, bossId, dungeonName, expectedDps) => {
		const link = getLink(mod.serverId, charName, continentId, bossId);
		let payload = await requestData(new url(link));

		if (!payload) {
			mod.command.message("Error happened in request!")
			return;
		}

		if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
			mod.command.message("Invalid API response! Zone isn't supported by MG, server is not available or mod need update.")
			return;
		}

		if (payload[1].length === 0) {
			mod.command.message(`This character have no data at MG for ${dungeonName} or name is invalid.`)
			return;
		}

		const grouped = cutData(payload, charName);
		const res = analyzeRuns(grouped, expectedDps);

		sendOutput(charName, dungeonName, res);
	};

	const startWrappedCheck = async (name) => {
		if (mod.settings.keepContinentsSequence)
			for(const x of mod.settings.continentsToCheck) await analyzeChar(name, x.continent, x.boss, x.name, x.expectedDpsAvg);
		else 
			for(const x of mod.settings.continentsToCheck) analyzeChar(name, x.continent, x.boss, x.name, x.expectedDpsAvg);
	};

	mod.hook('S_USER_PAPERDOLL_INFO', mod.majorPatchVersion >= 106 ? 13 : 12, event => {
		if (mod.settings.autoCheckAtInspect && event.name != mod.game.me.name) {

			if (throttleList.has(event.name) && Date.now() - throttleList.get(event.name) < THROTTLE_REPEAT_DURATION) return;

			throttleList.set(event.name, Date.now());

			startWrappedCheck(event.name);
		}
	});

	mod.command.add("ms", {
		$none() {
			mod.settings.autoCheckAtInspect = !mod.settings.autoCheckAtInspect;
			mod.command.message(`Automatic check at inspect was ${mod.settings.enabled ? "en" : "dis"}abled`);
		},
		seq() {
			mod.settings.keepContinentsSequence = !mod.settings.keepContinentsSequence;
			mod.command.message(`Slow check mode was ${mod.settings.keepContinentsSequence ? "en" : "dis"}abled`);
		},
		simple() {
			mod.settings.simplifiedOutput = !mod.settings.simplifiedOutput;
			mod.command.message(`Simplified output was ${mod.settings.simplifiedOutput ? "en" : "dis"}abled`);
		},
		i(name) {
			if(!name || name === "") {
				mod.command.message("Invalid nickname.");
				return;
			}

			startWrappedCheck(name);
		}
	}, this);
};
