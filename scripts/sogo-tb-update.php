<?php

/* sogo-tb-update.php - this file is part of SOGo
 *
 *  Copyright (C) 2006-2024 Alinto
 *
 * This file is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This file is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.  If not, write to
 * the Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

/* This script handles the automatic propagation of thunderbird extensions (thunderbird 115+). It requires PHP 5.0.0 or later. */

$latestVersion = array(
				   "version" => "115.0.0", // Change this
                   "filename" => "sogo-connector-116.0.0-0468b81969.xpi"  // Change this and put the xpi file at the same level than this script
);

class TbUpdate
{
    private $versions;

    function __construct($latestVersion)
    {
        $this->latestVersion = $latestVersion;
    }

    private function computeVersion($v)
    {
    	$ev = explode(".", $v);
    	if (count($ev) == 3) {
    		return ($ev[0] * 1000) + ($ev[1] * 100) + ($ev[2]);
    	} else {
    		return -1;
    	}
    }

    private function hasUpdate($v) {
    	return ($this->computeVersion($this->latestVersion["version"]) > $this->computeVersion($v)) ? true : false;
    }

    private function checkFile() {
    	return is_file($this->latestVersion["filename"]);
    }

    private function getXPIURL() {
    	return dirname(getenv("SCRIPT_URI"))."/".$this->latestVersion["filename"];
    }

    public function process() {
    	$content = "";
    	$rc = 403;
    	if (isset($_GET["v"])) {
    		if ($this->hasUpdate($_GET["v"])) {
    			if ($this->checkFile()) {
    				$ob = new stdClass();
	    			$ob->version = $this->latestVersion["version"];
	    			$ob->xpi = $this->getXPIURL();
	    			header("Content-Type: application/json; charset=utf-8");
	    			$content = json_encode($ob);
	    			$rc = 200;
    			} else {
    				$rc = 404;
    			}
    		} else {
    			$rc = 204;
    		}
    	} else {
    		$rc = 406;
    	}

    	header("HTTP/1.1 ".$rc." OK");
    	echo $content;
    }
    
}


$tbUpdate = new TbUpdate($latestVersion);
$tbUpdate->process();

?>