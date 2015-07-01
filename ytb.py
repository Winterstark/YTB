import sys, json, webbrowser
from urllib import request
from urllib.parse import quote
from os import path


def getChannelId(username):
	url = "https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=" + quote(username) + "&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk"
    
	inp = request.urlopen(url).read()
	resp = json.loads(inp.decode("utf-8"))
	
	if len(resp["items"]) > 0:
		id = resp["items"][0]["id"]
		
		print("Found channel id: " + id)
		return id
	else:
		print("Channel not found!")
		return -1


def getPlaylistId(channelId, playlist):
	url = "https://www.googleapis.com/youtube/v3/search?part=id%2Csnippet&channelId=" + channelId + "&q=" + quote(playlist) + "&type=playlist&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk"

	inp = request.urlopen(url).read()
	resp = json.loads(inp.decode("utf-8"))

	if len(resp["items"]) == 1:
		id = resp["items"][0]["id"]["playlistId"]
		
		print("Found playlist \"" + resp["items"][0]["snippet"]["title"] + "\" with id: " + id)
		return id
	if len(resp["items"]) > 0:
		print("Multiple playlists match your search query:")

		ind = 1
		for pl in resp["items"]:
			print(str(ind) + ". " + pl["snippet"]["title"])
			ind += 1

		ind = input("Choose one: ")
		ind = int(ind.replace(".", "")) - 1

		return resp["items"][ind]["id"]["playlistId"]
	else:
		return -1


def downloadChannelList(channel, lastWatched):
	channelId = getChannelId(channel)
	if channelId == -1:
		return []
	
	url = "https://www.googleapis.com/youtube/v3/search?part=id%2Csnippet&channelId=" + channelId + "&maxResults=50&order=date{0}&pageToken={1}&type=video&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk"
	videos = []
	publishedBefore = ""
	nAddedVideos = 0
	
	while publishedBefore != "no more results":
		pageToken = ""

		while pageToken != "no more results":
			print("URL: " + url.format(publishedBefore, pageToken))
			inp = request.urlopen(url.format(publishedBefore, pageToken)).read()
			resp = json.loads(inp.decode("utf-8"))

			for video in resp["items"]:
				videoId = video["id"]["videoId"]
				if videoId != lastWatched:
					if videoId not in videos:
						videos.append(videoId)
						nAddedVideos += 1
				else:
					print("Found " + str(len(videos)) + " videos")
					return videos

			print("Found " + str(len(videos)) + " videos")
			
			if "nextPageToken" in resp:
				pageToken = resp["nextPageToken"]
			else:
				pageToken = "no more results"

				newPublishedBefore = "&publishedBefore=" + resp["items"].pop()["snippet"]["publishedAt"]
				if newPublishedBefore != publishedBefore:
					publishedBefore = newPublishedBefore
				else:
					publishedBefore = "no more results"

	return videos


def downloadPlaylist(playlistId, lastWatched):
	url = "https://www.googleapis.com/youtube/v3/playlistItems?part=id%2Csnippet&maxResults=50&playlistId=" + playlistId + "&pageToken={0}&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk"
	videos = []
	pageToken = ""
	nAddedVideos = 0
	
	while pageToken != "no more results":
		inp = request.urlopen(url.format(pageToken)).read()
		resp = json.loads(inp.decode("utf-8"))

		for video in resp["items"]:
			videoId = video["snippet"]["resourceId"]["videoId"]
			if videoId not in videos:
				videos.append(videoId)
				nAddedVideos += 1
		
		if "nextPageToken" in resp:
			pageToken = resp["nextPageToken"]
		else:
			pageToken = "no more results"

	videos.reverse()

	if lastWatched != "":
		#remove old videos
		removeFrom = -1

		for i in range(len(videos)):
			if videos[i] == lastWatched:
				removeFrom = i
				break
		
		videos = videos[:removeFrom]

	print("Found " + str(len(videos)) + " videos")
	return videos


#MAIN
ROOT_DIR = "C:\\dev\\scripts\\ytb\\"

if len(sys.argv) < 2:
	print("Missing argument: channel name.")
	sys.exit(-1)
else:
	if len(sys.argv) > 2:
		#combine arguments into one
		for i in range(2, len(sys.argv)):
			sys.argv[1] += " " + sys.argv[i]

if '/' not in sys.argv[1]:
	channel = sys.argv[1]
	playlist = ""
	playlistId = -1
	filePath = ROOT_DIR + channel + ".txt"
else:
	sep = sys.argv[1].index('/')
	channel = sys.argv[1][:sep]
	playlist = sys.argv[1][sep+1:]
	filePath = ROOT_DIR + channel + "_" + playlist + ".txt"

if not path.isfile(filePath):
	#first time accessing this channel or playlist: download a list of videos
	if playlist == "":
		print("Downloading video list...")
		videos = downloadChannelList(channel, "")
	else:
		print("Downloading playlist...")

		channelId = getChannelId(channel)
		if channelId == -1:
			print("Channel not found!")
			sys.exit(-1)
		else:
			playlistId = getPlaylistId(channelId, playlist)
			if playlistId == -1:
				print("Playlist not found!")
				sys.exit(-1)
			else:
				videos = downloadPlaylist(playlistId, "")
else:
	#load previously downloaded list of videos
	with open(filePath) as f:
		videos = f.read().splitlines()

	if "playlistId=" in videos[0]:
		playlistId = videos[0][videos[0].index('=')+1:]
		videos.remove(videos[0])

	if videos[0] == "watched all":
		#watched all videos; download new ones
		if playlist == "":
			print("Refreshing video list...")
			videos = downloadChannelList(channel, videos[1])
		else:
			print("Refreshing playlist...")
			videos = downloadPlaylist(playlistId, videos[1])

if len(videos) > 0:
	video = videos.pop()
	webbrowser.open("https://www.youtube.com/watch?v=" + video)
	
	#save remaining videos
	if len(videos) == 0:
		videos = ["watched all", video] #remember last watched video
	
	with open(filePath, "w") as f:
		if playlistId != -1:
			f.write("playlistId=" + playlistId + "\n")

		for video in videos:
			f.write(video + "\n")