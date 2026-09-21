<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

defined('MOODLE_INTERNAL') || die();

$plugin->component = 'local_courseprogressnotify';
$plugin->version   = 2026092101; // YYYYMMDDXX (build number).
$plugin->release   = '2.10.0';
$plugin->maturity  = MATURITY_STABLE;
// Requires Moodle 4.4 or later (approximate build number for 4.4).
$plugin->requires  = 2024042200;
// Repo: https://github.com/LeoLeto/Awakelab-moodle-emails.git