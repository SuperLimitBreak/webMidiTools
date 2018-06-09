import {
	range,
	assertEqualsObject,
	previousValueIterator,
	enumerate,
	chain,
	zip,
} from '../libs/es6/core.js'

import {
	NUM_NOTES_IN_OCTAVE,
	normalize_octave,
	text_to_note,
	note_to_text,
} from '../libs/es6/music.js'


function* fretDistance(frets=21, scale_length=648) {
	// https://en.wikipedia.org/wiki/Guitar#Frets
	// https://en.wikipedia.org/wiki/Scale_length_(string_instruments)
	// Distance fron nut to 12th Fret = half the scale_length
	let distance_from_nut = 0;
	for (let i of range(frets)) {
		yield distance_from_nut += ((scale_length - distance_from_nut) / 17.817);
	}
}
//assertEquals([
//	[],
//]);


export function drawGuitarFretboard(context, notes, options={
	lineWidth: 0.03,
	fontFace: 'serif',
	activeNoteColor: "#FF0000",
	passiveNoteColor: "#CCCCCC",
	showPassiveNotes: true,
	tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
	stringColor: '#CCCCCC',
	number_of_frets: 21,
}) {
	context = context instanceof String ? document.getElementById(canvas).getContext("2d") : context;
	console.assert(context instanceof CanvasRenderingContext2D, `Unable to draw on ${context}`);

	notes = notes instanceof Set ? [...notes.keys()].map(normalize_octave) : notes;
	notes = notes ? notes : [];
	console.assert(notes instanceof Array, 'notes must be an Array');

	const _options = {
		lineWidth: options.lineWidth * context.canvas.height,
		tuning: options.tuning.map(text_to_note).map(normalize_octave),
	}
	context.font = `${_options.lineWidth}px ${options.fontFace}`;
	context.lineWidth = 1;  //_options.lineWidth
	const FRET_HEIGHT = context.canvas.height / (options.number_of_frets + 1);  // +1 is for nut/border

	// Background
	context.setTransform(1,0,0,1,0,0); // Reset translations (why is there not a convenience call for this?)
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);

	// Strings
	context.fillStyle = options.stringColor;
	context.strokeStyle = context.fillStyle;
	const STRING_WIDTH = context.canvas.width / options.tuning.length;
	for (let [string_number, string_note_text] of enumerate(options.tuning)) {
		const STRING_X = (string_number * STRING_WIDTH) + (STRING_WIDTH/2);
		//context.fillText(string_note_text, STRING_X - context.measureText(string_note_text).width/2, FRET_HEIGHT/2);
		context.beginPath();
		context.moveTo(STRING_X, FRET_HEIGHT);
		context.lineTo(STRING_X, context.canvas.height);
		context.stroke();
		context.closePath();
	}

	// Frets
	context.fillStyle = "#000000";
	context.strokeStyle = context.fillStyle;
	//previousValueIterator(fretDistance(21, context.canvas.height))
	function* notes_per_fret() {
		for (let fret_number of range(options.number_of_frets)) {
			yield _options.tuning.map(note => note + fret_number).map(normalize_octave);
		}
	}
	for (let [[fret_start, fret_end], notes_for_fret] of zip(
		previousValueIterator(range(context.canvas.height, FRET_HEIGHT, FRET_HEIGHT)),
		notes_per_fret(),
	)) {
		fret_start = fret_start ? fret_start : 0;

		context.beginPath();
		context.moveTo(0, fret_end);
		context.lineTo(context.canvas.width, fret_end);
		context.stroke();
		context.closePath();

		console.log(fret_start, fret_end, notes_for_fret);
		for (let [string_number, note] of enumerate(notes_for_fret)) {
			const STRING_X = (string_number * STRING_WIDTH) + (STRING_WIDTH/2);
			const note_active = notes.indexOf(note) >= 0;
			const string_note_text = note_to_text(note, {format:'%NOTE_LETTER_WITH_SHARP%'});
			context.fillStyle = note_active ? options.activeNoteColor : options.passiveNoteColor;
			if (note_active || (!note_active && options.showPassiveNotes)) {
				context.fillText(string_note_text, STRING_X - context.measureText(string_note_text).width/2, fret_end);
			}
			console.log(string_number, string_note_text);
		}
	}
}

export default {
	drawGuitarFretboard,
}