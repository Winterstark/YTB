var YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3/";
var API_KEY_SUFFIX = "&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk";

var PageTypeEnum = Object.freeze({
	Channel: 0,
	User: 1,
	Playlist: 2,
	Video: 3,
	None: 4
});

var url; //current tab url
var lists; //list of saved channel archives and playlists
var searchUrl, searchId, videos, lastWatched, thumbnailUrl, publishedBefore, nAddedVideos, pageToken, openFirstLinkWhenFinished; //global variables used when listing channel videos


function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    url = tab.url;
    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback();
  });
}

function processYouTubeUrl(url) {
	var pageType, id;

	if (url.includes("youtube.com/channel/"))
	{
		pageType = PageTypeEnum.Channel;

		var lb = url.indexOf("youtube.com/channel/") + 20;
		var ub = url.indexOf('/', lb);
		if (ub == -1)
			ub = url.length;
		id = url.substring(lb, ub);
	}
	else if (url.includes("youtube.com/user/"))
	{
		pageType = PageTypeEnum.User;

		var lb = url.indexOf("youtube.com/user/") + 17;
		var ub = url.indexOf('/', lb);
		if (ub == -1)
			ub = url.length;
		id = url.substring(lb, ub);
	}
	else if (url.includes("list="))
	{
		pageType = PageTypeEnum.Playlist;
		id = url.substring(url.indexOf("list=") + 5, url.length);
	}
	else if (url.includes("/watch?v="))
	{
		pageType = PageTypeEnum.Video;

		var lb = url.indexOf("/watch?v=") + 9;
		id = url.substring(lb, lb + 11);
	}
	else
	{
		pageType = PageTypeEnum.None;
		id = -1;
	}

	return [pageType, id];
}

//send a GET HTTP request to YouTube and return parsed JSON response when it arrives
function GETRequest(url, callback) {
	var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState == 4 && request.status == 200)
	    	callback(JSON.parse(request.responseText));
	}

	request.open("GET", YOUTUBE_BASE_URL + url + API_KEY_SUFFIX, true);
	request.send();
}

//get YouTube channel id from username
function getChannelId(username, callback) {
	GETRequest("channels?part=id%2Csnippet&forUsername=" + username, function(response) {
		thumbnailUrl = response.items[0].snippet.thumbnails.default.url;
		callback(response.items[0].id, "", false);
	});
}

//get YouTube channel id from videoId
function getChannelIdFromVideo(videoId, callback) {
	GETRequest("videos?part=snippet&id=" + videoId, function(response) {
		thumbnailUrl = response.items[0].snippet.thumbnails.default.url;
		callback(response.items[0].snippet.channelId, "", false);
	})
}

//save video archive from a YouTube channel name
function addChannel() {
	var type_id = processYouTubeUrl(url);
	var type = type_id[0];
	var id = type_id[1];

	switch (type)
	{
		case PageTypeEnum.Channel:
			GETRequest("channels?part=snippet&id=" + id, function(response) { //get channel thumbnail first
				thumbnailUrl = response.items[0].snippet.thumbnails.default.url;
				addChannelFromId(id, "", false);
			});
			break;
		case PageTypeEnum.User:
			getChannelId(id, addChannelFromId);
			break;
		case PageTypeEnum.Video:
			getChannelIdFromVideo(id, addChannelFromId);
			break;
	}
}

//save video archive from a YouTube channel Id
function addChannelFromId(channelId, lastWatchedParameter, openFirstLinkWhenFinishedParameter) {
	if (lists.hasOwnProperty(channelId))
		alert("Channel already added!" + channelId);
	else
	{
		if (channelId == -1)
			return [];
		
		searchUrl = "search?part=id%2Csnippet&channelId=" + channelId + "&maxResults=50&order=date{0}&pageToken={1}&type=video"
		searchId = channelId;
		videos = [];
		lastWatched = lastWatchedParameter;
		publishedBefore = "";
		nAddedVideos = 0;
		pageToken = "";
		openFirstLinkWhenFinished = openFirstLinkWhenFinishedParameter;
		
		GETRequest(searchUrl.replace("{0}", publishedBefore).replace("{1}", pageToken), addChannel_ProcessResponse);
	}
}

//process a page of search results
function addChannel_ProcessResponse(response)
{
	var channelTitle = "";
	if (response.items.length > 0)
		channelTitle = response.items[0].snippet.channelTitle;

	for (var i = 0; i < response.items.length; i++)
	{
		var videoId = response.items[i].id.videoId;
		if (videoId != lastWatched) 
		{
			if (videos.indexOf(videoId) == -1)
			{
				videos.push(videoId);
				nAddedVideos++;
			}
		}
		else
		{
			channelListCompleted(channelTitle);
			return;
		}
	}

	if (response.hasOwnProperty("nextPageToken"))
		pageToken = response.nextPageToken;
	else
	{
		pageToken = "no more results";

		var newPublishedBefore = "&publishedBefore=" + response.items.pop().snippet.publishedAt;
		if (newPublishedBefore != publishedBefore)
			publishedBefore = newPublishedBefore;
		else
			publishedBefore = "no more results";
	}

	if (pageToken != "no more results")
		GETRequest(searchUrl.replace("{0}", publishedBefore).replace("{1}", pageToken), addChannel_ProcessResponse);
	else
	{
		if (publishedBefore != "no more results")
		{
			pageToken = "";
			GETRequest(searchUrl.replace("{0}", publishedBefore).replace("{1}", pageToken), addChannel_ProcessResponse);
		}
		else
			channelListCompleted(channelTitle);
	}
}

//save channel list
function channelListCompleted(channelTitle) {
	if (videos.length == 0)
	{
		alert("No new videos found!");
		chrome.tabs.create({url: "https://www.youtube.com/user/" + channelTitle + "/videos"});
	}
	else
	{
		if (videos.length > 250)
			videos.splice(0, videos.length - 250); //saving more than 250 videos at a time might be too much for QUOTA_BYTES_PER_ITEM

		var videoId = "";
		if (openFirstLinkWhenFinished)
		{
			videoId = videos.pop();
			chrome.tabs.create({url: "https://www.youtube.com/watch?v=" + videoId});
		}
		
		lists[searchId] = {
			name: channelTitle,
			playlist: false,
			videoList: videos,
			thumbnail: thumbnailUrl
		};

		if (videoId != "")
			lists[searchId].lastWatched = videoId;
	}

	chrome.storage.local.set({"lists": lists});
	buildUI();
}

//save YouTube playlist
function addPlaylist() {
	addPlaylistFromId(url.substring(url.indexOf("list=") + 5, url.length), "", false);
}

//save YouTube playlist from Id
function addPlaylistFromId(playlistId, lastWatchedParameter, openFirstLinkWhenFinishedParameter) {
	if (lists.hasOwnProperty(playlistId))
		alert("Playlist already added!");
	else
	{
		searchId = playlistId;
		searchUrl = "playlistItems?part=id%2Csnippet&maxResults=50&playlistId=" + searchId + "&pageToken={0}";
		videos = [];
		pageToken = "";
		lastWatched = lastWatchedParameter;
		openFirstLinkWhenFinished = openFirstLinkWhenFinishedParameter;

		GETRequest(searchUrl.replace("{0}", pageToken), addPlaylist_ProcessResponse);
	}
}

//process a page of search results
function addPlaylist_ProcessResponse(response) {
	for (var i = 0; i < response.items.length; i++)
	{
		videoId = response.items[i].snippet.resourceId.videoId;
		if (videos.indexOf(videoId) == -1)
			videos.push(videoId);
	}

	if (response.hasOwnProperty("nextPageToken"))
		pageToken = response.nextPageToken;
	else
		pageToken = "no more results";

	if (pageToken != "no more results")
		GETRequest(searchUrl.replace("{0}", pageToken), addPlaylist_ProcessResponse);
	else
		GETRequest("playlists?part=snippet&id=" + searchId, playlistCompleted); //final request to get playlist name
}

//save channel list
function playlistCompleted(response) {
	var playlistTitle = "Playlist";
	if (response.items.length > 0)
		playlistTitle = response.items[0].snippet.title;
	thumbnailUrl = response.items[0].snippet.thumbnails.default.url;

	if (videos.length == 0)
		alert("Playlist is empty!");
	else
	{
		videos.reverse();

		if (lastWatched != "")
		{
			//remove old videos
			var removeFrom = -1;
			for (var i = 0; i < videos.length; i++)
				if (videos[i] == lastWatched)
				{
					removeFrom = i;
					break;
				}

			videos.splice(removeFrom, videos.length - removeFrom);
		}

		if (videos.length == 0)
		{
			alert("No new videos found!");
			chrome.tabs.create({url: "https://www.youtube.com/playlist?list=" + searchId});
		}
		else
		{
			var videoId = "";
			if (openFirstLinkWhenFinished)
			{
				videoId = videos.pop();
				chrome.tabs.create({url: "https://www.youtube.com/watch?v=" + videoId});
			}

			lists[searchId] = {
				name: playlistTitle,
				playlist: true,
				videoList: videos,
				thumbnail: thumbnailUrl
			};

			if (videoId != "")
				lists[searchId].lastWatched = videoId;
		}
	}

	chrome.storage.local.set({"lists": lists});
	buildUI();
}

//open the next video in a video archive or playlist
function openNextVideo() {
	if (lists[this.id].videoList.length == 0)
	{
		var id = this.id;
		var lastWatched = lists[id].lastWatched;
		var playlist = lists[id].playlist;
		thumbnailUrl = lists[id].thumbnailUrl;

		delete lists[id];
		
		if (playlist)
			addPlaylistFromId(id, lastWatched, true);
		else
			addChannelFromId(id, lastWatched, true);
	}
	else
	{
		var videoId = lists[this.id].videoList.pop();
		chrome.tabs.create({url: "https://www.youtube.com/watch?v=" + videoId});

		lists[this.id].lastWatched = videoId;
		chrome.storage.local.set({"lists": lists});
	}
}

//delete a channel archive or playlist
function delList() {
	var id = this.id.substring(4, this.id.length);

	if (confirm("Are you sure you want to permanently delete " + lists[id].name + "?"))
	{
		delete lists[id];
		chrome.storage.local.set({"lists": lists});
		buildUI();
	}
}

//set the last watched video
function editList() {
	var id = this.id.substring(5, this.id.length);

	var newLastWatched = prompt("Enter the videoID or URL of the last watched video:", lists[id].lastWatched);
	if (newLastWatched != null && newLastWatched != lists[id].lastWatched) {
		if (newLastWatched.includes("/watch?v="))
		{
			//grab only the videoId
			var lb = newLastWatched.indexOf("/watch?v=") + 9;
			newLastWatched = newLastWatched.substring(lb, lb+11);
		}

		if (lists[id].videoList.indexOf(newLastWatched) == -1)
			alert("The video list does not contain the specified videoID!");
		else
		{
			var lastDeleted = "";
			while (lastDeleted != newLastWatched)
				lastDeleted = lists[id].videoList.pop();

		    lists[id].lastWatched = newLastWatched;
			chrome.storage.local.set({"lists": lists});
			buildUI();
		}
	}
}

//setup UI stuff
function buildUI() {
	//existing content
	document.getElementById("lists").innerHTML = "";

	for (var item in lists)
	{
		document.getElementById("lists").innerHTML += "<p id=\"item\">"
		document.getElementById("lists").innerHTML += "<img src=\"" + lists[item].thumbnail + "\">";
		document.getElementById("lists").innerHTML += lists[item].name + "<br>";
		document.getElementById("lists").innerHTML += "<button id=\"" + item + "\" type=\"button\">Open next video</button>";
		document.getElementById("lists").innerHTML += "<button class=\"del\" id=\"del_" + item + "\" type=\"button\">Delete</button>";
		document.getElementById("lists").innerHTML += "<button class=\"edit\" id=\"edit_" + item + "\" type=\"button\">Edit</button>";
		document.getElementById("lists").innerHTML += "</p>";
	}

	for (var item in lists)
	{
		document.getElementById(item).onclick = openNextVideo;
		document.getElementById("del_" + item).onclick = delList;
		document.getElementById("edit_" + item).onclick = editList;
	}

	//show add button for new content
	var type_id = processYouTubeUrl(url);
	var type = type_id[0];
	var id = type_id[1];

	switch (type)
	{
		case PageTypeEnum.Channel:
			if (!lists.hasOwnProperty(id))
				showAddContentButton(true);
			break;
		case PageTypeEnum.User:
			var alreadyAdded = false;
			for (var item in lists)
				if (lists[item].name == id)
				{
					alreadyAdded = true;
					break;
				}
			
			if (!alreadyAdded)
				showAddContentButton(true);
			break;
		case PageTypeEnum.Playlist:
			if (!lists.hasOwnProperty(id))
				showAddContentButton(false);
			break;
		case PageTypeEnum.Video:
			var alreadyAdded = false;
			for (var item in lists)
				if (lists[item].lastWatched == id || lists[item].videoList.indexOf(id) != -1)
				{
					alreadyAdded = true;
					break;
				}

			if (!alreadyAdded)
				showAddContentButton(true);
			break;
	}
}

//show add content button
function showAddContentButton(channel) {
	if (channel)
	{
		document.getElementById("addContent").innerHTML = "<button class=\"addContentButton\" id=\"addChannelButton\" type=\"button\">Add channel</button>";
		document.getElementById("addChannelButton").onclick = addChannel;
	}
	else
	{
		document.getElementById("addContent").innerHTML = "<button class=\"addContentButton\" id=\"addPlaylistButton\" type=\"button\">Add playlist</button>";
		document.getElementById("addPlaylistButton").onclick = addPlaylist;	
	}
}

//MAIN
document.addEventListener('DOMContentLoaded', function() {
	getCurrentTabUrl(function() {
		chrome.storage.local.get("lists", function(items) {
			if (items.hasOwnProperty("lists"))
				lists = items.lists;
			else
				lists = {};
			
			buildUI();
		});
	});
});