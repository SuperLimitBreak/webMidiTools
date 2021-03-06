// https://en.wikipedia.org/wiki/MIDI_timecode
// http://midi.teragonaudio.com/tech/mtc.htm
// https://www.recordingblogs.com/wiki/midi-quarter-frame-message
// http://artsites.ucsc.edu/EMS/music/equipment/computers/max/MTC/Max_MTC.html

// Compared with MTCSender https://www.styletronix.net/Software/MTC/info.aspx

import {
	assertEquals,
	assertEqualsObject,
} from './core.js'




// https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
// https://stackoverflow.com/questions/33289726/combination-of-async-function-await-settimeout
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// await sleep(1000);

// -----------------------------------------------------------------------------

self.addEventListener('message', (event)=>{
	const message = event.data.message;
	if (message == 'seek') {
		console.log('seek', event.data.timestamp);
		seek(event.data.timestamp);
	} else
	if (message == 'play') {
		console.log('play', event.data.timestamp);
		play(event.data.timestamp);
	}
	if (message == 'stop') {
		console.log('stop');
		playing = false;
	}


});

//------------------------------------------------------------------------------

const milliseconds_in_second = 1000;
const milliseconds_in_minuet = 60 * milliseconds_in_second;
const milliseconds_in_hour = 60 * milliseconds_in_minuet;
const milliseconds_in_day = 24 * milliseconds_in_hour;
const MTCFullRateLookup = {
	24: 0b00,
	25: 0b01,
	29.97: 0b10,
	30: 0b11,
};

function timecode_to_components(timecode_milliseconds, {fps=30}) {
	const milliseconds_per_frame = (1/fps) * milliseconds_in_second;
	const milliseconds_per_quarter_frame = milliseconds_per_frame / 4;
	const absolute_frame = Math.floor(timecode_milliseconds / milliseconds_per_frame);
	const absolute_quarter_frame = Math.floor(timecode_milliseconds / milliseconds_per_quarter_frame);
	const timecode_milliseconds_next_frame = (absolute_frame+1) * milliseconds_per_frame;
	const timecode_milliseconds_next_quarter_frame = (absolute_quarter_frame+1) * milliseconds_per_quarter_frame;
	return {
		timecode_milliseconds,
		fps,
		milliseconds_per_frame,
		milliseconds_per_quarter_frame,
		absolute_frame,
		absolute_quarter_frame,
		timecode_milliseconds_next_frame,
		timecode_milliseconds_next_quarter_frame,
		sleep_to_frame: timecode_milliseconds_next_frame - timecode_milliseconds,
		sleep_to_quarter_frame: timecode_milliseconds_next_quarter_frame - timecode_milliseconds,
		frame: Math.floor(((timecode_milliseconds % milliseconds_in_second)/milliseconds_in_second)*fps),
		seconds: Math.floor(((timecode_milliseconds % milliseconds_in_minuet)/milliseconds_in_second)),
		minuets: Math.floor(((timecode_milliseconds % milliseconds_in_hour)/milliseconds_in_minuet)),
		hours: Math.floor(((timecode_milliseconds % milliseconds_in_day)/milliseconds_in_hour)),
	};
}


function MTCFull(timecode, {fps=30}) {
	const rate = (MTCFullRateLookup[fps] || 0) * 0b100000;
	if (typeof(timecode)=="number") {
		timecode = timecode_to_components(timecode, {fps});
	}
	const {hours, minuets, seconds, frame} = timecode;
	return [0xF0, 0x7F, 0x7F, 0x01, 0x01, rate+hours, minuets, seconds, frame, 0xF7];
}

function MTCQuarter(timecode, {fps=30}) {
	const lower_4_bits = 0b00001111;
	const upper_4_bits = 0b11110000;
	function _piece(i, nibble) {
		//console.assert(nibble <= lower_4_bits);
		//console.assert(i <= 8);
		return (i * 0b10000) + nibble;
	}

	const rate = (MTCFullRateLookup[fps] || 0) * 0b10;
	if (typeof(timecode)=="number") {
		timecode = timecode_to_components(timecode, {fps});
	}
	const {hours, minuets, seconds, frame} = timecode;
	return [
		_piece(0, frame & lower_4_bits     ),
		_piece(1, (frame & upper_4_bits) >> 4),
		_piece(2, seconds & lower_4_bits     ),
		_piece(3, (seconds & upper_4_bits) >> 4),
		_piece(4, minuets & lower_4_bits     ),
		_piece(5, (minuets & upper_4_bits) >> 4),
		_piece(6, hours & lower_4_bits     ),
		_piece(7, (hours & upper_4_bits) >> 4) + rate,
	];
}

// Tests -----------------------------------------------------------------------

// 320100 -> 5min 20seconds frame3(at30fps)
assertEqualsObject([
	[timecode_to_components(320100,{fps:30}), {
		"timecode_milliseconds": 320100,
		"fps": 30,
		"milliseconds_per_frame": 33.333333333333336,
		"milliseconds_per_quarter_frame": 8.333333333333334,
		"absolute_frame": 9603,
		"absolute_quarter_frame": 38412,
		"timecode_milliseconds_next_frame": 320133.3333333334,
		"timecode_milliseconds_next_quarter_frame": 320108.3333333334,
		"sleep_to_frame": 33.33333333337214,
		"sleep_to_quarter_frame": 8.333333333372138,
		"frame": 3,
		"seconds": 20,
		"minuets": 5,
		"hours": 0
	}],
]);

function _to_hex_string(bytes) {return bytes.map(x=>x.toString(16).padStart(2,'0')).join('');}
const MTCFullHexTemplate = 'f07f7f0101hhmmssfff7';
assertEquals([
	[_to_hex_string(MTCFull(0,{fps:24})), MTCFullHexTemplate.replace('hhmmssff', '00000000')],
	[_to_hex_string(MTCFull(0,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '60000000')],
	[_to_hex_string(MTCFull(100,{fps:24})), MTCFullHexTemplate.replace('hhmmssff', '00000002')],
	[_to_hex_string(MTCFull(100,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '60000003')],
	[_to_hex_string(MTCFull(20000,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '60001400')],
	[_to_hex_string(MTCFull(20100,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '60001403')],
	[_to_hex_string(MTCFull(320100,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '60051403')],
	[_to_hex_string(MTCFull(320100+milliseconds_in_hour,{fps:30})), MTCFullHexTemplate.replace('hhmmssff', '61051403')],
]);
assertEquals([
	[_to_hex_string(MTCQuarter(0,{fps:24})), '00 10 20 30 40 50 60 70'.replaceAll(' ','')],
	[_to_hex_string(MTCQuarter(100,{fps:24})), '02 10 20 30 40 50 60 70'.replaceAll(' ','')],
	[_to_hex_string(MTCQuarter(100,{fps:30})), '03 10 20 30 40 50 60 76'.replaceAll(' ','')],
	[_to_hex_string(MTCQuarter(20100,{fps:30})), '03 10 24 31 40 50 60 76'.replaceAll(' ','')],
]);

// -----------------------------------------------------------------------------



function sendMidi(data) {
	postMessage({message: 'sendMidi', data});
}


let playing = false;
let absolute_quarter_frame;
const quarter_frame_messages = [];

async function play(timestamp_offset, fps=30) {
	timestamp_offset = (timestamp_offset || 0);
	const timestamp_begin = performance.now() - timestamp_offset;
	playing = true;
	absolute_quarter_frame = timecode_to_components(timestamp_offset, {fps}).absolute_quarter_frame;
	quarter_frame_messages.length=0;
	while (playing) {
		const timecode_milliseconds = performance.now() - timestamp_begin;
		let timecode_components = timecode_to_components(timecode_milliseconds, {fps});

		function get_next_quarter_frame_message() {
			if (quarter_frame_messages.length == 0) {
				quarter_frame_messages.push(...MTCQuarter(timecode_components, {fps}));
				postMessage({message: 'playing', timecode_components});
			}
			return quarter_frame_messages.shift();
		}

		let quarter_frames_sent;
		for (quarter_frames_sent=0 ; quarter_frames_sent < timecode_components.absolute_quarter_frame - absolute_quarter_frame ; quarter_frames_sent++) {
			sendMidi([0xF1, get_next_quarter_frame_message()]);
		}
		absolute_quarter_frame += quarter_frames_sent;
		
		await sleep(timecode_components.sleep_to_quarter_frame);
	}
}

function seek(timestamp, fps=30) {
	sendMidi(MTCFull(timestamp, {fps}));
}
