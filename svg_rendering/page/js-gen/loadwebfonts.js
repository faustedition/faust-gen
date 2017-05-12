/*
 * Copyright (c) 2014 Faust Edition development team.
 *
 * This file is part of the Faust Edition.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

if (window.Faust === undefined) {
	window.Faust = {};
}

(function (Faust) {

	Fonts = {};
	Fonts.active = function (callback) {


		var fontError = false;
		var webFontConfig = {
			custom: {
				families: ['Ubuntu', 'Ubuntu Monospace', 'Gentium Plus'],
				// we don not need to specify urls as they are specified in the css files
				urls: ['/css/webfonts.css']
			},
			// do not time out if font can't be loaded
			timeout: 10, //Number.MAX_VALUE,
			active: function () {
				// if we made it this far without 'fontinactive' occurring, then all
				// fonts have been loaded
				if (!Faust.TranscriptConfiguration.forceFontLoading || !fontError) {
					callback();
				} else {
					// do not try to render page
				}

			},
			fontinactive: function (familyName, fvd) {
				// font could not be loaded, abort
				if (Faust.TranscriptConfiguration.forceFontLoading) {
					fontError = true;
					var message = "Error: web font could not be loaded: " + familyName + " " + fvd;
					var htmlMessage = document.createElement('div');
					htmlMessage.innerHTML = message;
					document.body.append(htmlMessage);
					throw(message);
				}
			}
		};

		WebFont.load(webFontConfig);
	};

	Faust.Fonts = Fonts;
})(Faust);

