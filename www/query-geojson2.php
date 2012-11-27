<?php

//Connecting to the database
$myDatabase = mysql_connect("localhost","sewnet_4sq","foursq654"); //server, username, password
$charset = mysql_client_encoding($myDatabase);
//echo "The current character set is: $charset\n";
if (!$myDatabase)
{
die('Could not connect: ' . mysql_error());
}

mysql_select_db("sewnet_foursq", $myDatabase);

//http://weareherenow.org/query.php?xhigh=1000000&xlow=930000&yhigh=145000&ylow=135000
//http://weareherenow.org/query.php?xhigh=1000000&xlow=930000&yhigh=245000&ylow=130000&type=Food

$time = time() - 32400;
//$date = date("Y-m-d H:i:s",time()-14400);

$query = "SELECT DISTINCT name, vid, lat, lng, cat2, herenow FROM uniq_venues WHERE lng < $_GET[xhigh] AND lng > $_GET[xlow] AND lat < $_GET[yhigh] AND lat > $_GET[ylow]";
//AND HOUR(timestamp) - HOUR(CURRENT_TIMESTAMP) < 5 //timestamp piece
//$query = "SELECT DISTINCT name, vid, lat, lng, cat2, herenow FROM uniq_venues WHERE lng < $_GET[xhigh] AND lng > $_GET[xlow]";
$query .= (array_key_exists("type", $_GET) ? " AND cat2 = \"$_GET[type]\"" : "");
if (array_key_exists("checklow", $_GET) )
	$query .= " AND herenow > $_GET[checklow]";
if(array_key_exists("checkhigh", $_GET) )
	$query .= " AND herenow < $_GET[checkhigh]";
//$query .= " ORDER by timestamp DESC LIMIT 5";
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
$points = array();
$collection = array();if($numRows != null){
	//fwrite($f, "var data = {\"type\":\"GeometryCollection\", \"features\":[");
		
	// Loop through each row
	for ($i = 0; $i < $numRows; $i += 1) {
		$row = mysql_fetch_assoc($result);
		//echo "$row";
		//print_r($row);
		//echo "<br/>";
		
		//GEORGIA ATTEMPT 2
		$type1 = 'Feature';
		$type2 = 'Point';
		$lat = $row['lat'];
		$lng = $row['lng'];
		$coords = array($lng, $lat);
		$geometry = array('type'=>$type2, 'coordinates'=>$coords);
		$cat = $row['cat2'];
		$name = $row['name'];
		$herenow = $row['herenow'];
		/*Categories:
		 		AE "Arts & Entertainment"; color: #FECFFF
		 		CU "College & University"; color: #CCCCCC
		 		food "Food", color: #FFFB00
		 		homeWork "Professional & Other Places", color: #FF2F00
		 		nightlife "Nightlife Spot" color: #FB00FF
		 		outdoors = "Great Outdoors", color: #00FF00
		 		shops = "Shop & Service", color: #00CCFF
		 		travel = "Travel & Transport", color: #0037FF
		 		home = Residence, color: TBD
		*/
	    if($cat === 'Arts & Entertainment'){$fillColor= '#FECFFF';}
	    if($cat === 'College & University'){$fillColor= '#CCCCCC';}
	    if($cat === 'Food') {$fillColor= '#FFFB00';}
	    if($cat === 'Professional & Other Places'){$fillColor= '#FF2F00';}
	    if($cat === 'Nightlife Spot'){$fillColor= '#FB00FF';}
	    if($cat === 'Great Outdoors'){$fillColor= '#00FF00';}
	    if($cat === 'Shop & Service'){$fillColor= '#00CCFF';}
	    if($cat === 'Travel & Transport'){$fillColor= '#0037FF';}
	    if($cat === 'Residence') {$fillColor= '#FF2F00';}
			
		$style = array('opacity'=>'0.8', 'fillColor'=>$fillColor, 'color'=>$fillColor, 'weight'=>'0.5', 'fillOpacity'=>'0.5');
		$popupContent = 'This is popup content.';
		$properties = array('category'=>$cat, 'name'=>$name, 'herenow'=>$herenow, 'style'=>$style, 'radius'=>$herenow, 'popupContent'=>$popupContent);
		//$point = array();
		$point = array('type'=>$type1, 'geometry'=>$geometry, 'properties'=>$properties);
		$points[$i] = $point;
		unset($point);
		//array_push($points, $point);
		//echo "$points";
			
	}
	
	$type3 = 'FeatureCollection';
	$collection = array('type'=>$type3, 'features'=>$points);
	//$f = fopen("datafile.js", "w");
	$JSON = json_encode($collection);
	//fwrite($f, $JSON);
	//fclose($f);
	echo $JSON;
	
	//fwrite($f, "]};");}else{//	fwrite($f, "var data = {\"type\":\"GeometryCollection\", \"features\":[{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-73.9982,40.7270]},\"properties\":{\"category\":\"TEST\",\"name\":\"TEST\",\"herenow\":\"1\"}},{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-74.9982,40.7270]},\"properties\":{\"category\":\"TEST\",\"name\":\"TEST\",\"herenow\":\"1\"}}]};");
	/*$f = fopen("datafile.js", "w");
	fwrite($f, json_encode($response));
	fclose($f);*/
	//echo "broken";
}
?>