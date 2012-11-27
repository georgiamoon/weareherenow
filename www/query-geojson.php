<?php

//Connecting to the database
$myDatabase = mysql_connect("mysql.weareherenow.org","foursq","foursq654"); //server, username, password
if (!$myDatabase)
{
die('Could not connect: ' . mysql_error());
}

mysql_select_db("foursq", $myDatabase);

//http://weareherenow.org/query.php?xhigh=1000000&xlow=930000&yhigh=145000&ylow=135000
//http://weareherenow.org/query.php?xhigh=1000000&xlow=930000&yhigh=245000&ylow=130000&type=Food

$time = time() - 32400;
//$date = date("Y-m-d H:i:s",time()-14400);

$query = "SELECT DISTINCT name, vid, x, y, cat2, herenow FROM venue2hr WHERE x < $_GET[xhigh] AND x > $_GET[xlow] AND y < $_GET[yhigh] AND y > $_GET[ylow] AND HOUR(timestamp) - HOUR(CURRENT_TIMESTAMP) < 2";
$query .= (array_key_exists("type", $_GET) ? " AND cat2 = \"$_GET[type]\"" : "");
if (array_key_exists("checklow", $_GET) )
	$query .= " AND herenow > $_GET[checklow]";
if(array_key_exists("checkhigh", $_GET) )
	$query .= " AND herenow < $_GET[checkhigh]";
$query .= " ORDER by timestamp DESC LIMIT 2000";

//echo "query happened<br />";
//echo "$query <br />";

$result = mysql_query($query);
if (!$result) {
		//echo 'Could not run query: ' . mysql_error();
		exit;
	}
// See how many rows there are in the result set
$numRows = mysql_num_rows($result);
//echo "there are $numRows in the table<br />";

//$f = fopen("datafile.js", "w");
if($numrows != null){
	echo "{\"type\":\"FeatureCollection\", \"Features\":[";
		
	// Loop through each row
	for ($i = 0; $i < $numRows; $i += 1) {
		$row = mysql_fetch_assoc($result);
		echo "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[$row[x],$row[y]]},\"properties\":{\"category\":\"$row[cat2]\",\"name\":\"$row[name]\",\"herenow\":\"$row[herenow]\"}}";
		if ($i < $numRows-1)
			{ echo ",";}
		//$query2 = "SELECT tips FROM tips WHERE vid = \"$row[vid]\"";
		//$query2 .= " ORDER by timestamp DESC LIMIT 1";
		//$result2 = mysql_query($query2);
		//$row2 = mysql_fetch_assoc($result2);
		//echo "^$row2[tips]\n";
	
	}
	echo "]}";}else{	echo "{\"type\":\"FeatureCollection\", \"features\":[{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-73.9982,40.7270]},\"properties\":{\"category\":\"TEST\",\"name\":\"TEST\",\"herenow\":\"1\"}}]}";}
?>