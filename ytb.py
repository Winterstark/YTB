import sys, json, webbrowser
from urllib import request
from os import path


def getChannelId(username):
	url = "https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=" + username + "&key=AIzaSyDWnRZXQYSN5V-dz0sXe-iZ0dwLQTXJ_Uk"

	inp = request.urlopen(url).read()
	resp = json.loads(inp.decode("utf-8"))
	
	if len(resp["items"]) > 0:
		id = resp["items"][0]["id"]
		
		print("Found channel Id: " + id)
		return id
	else:
		print("Channel not found!")
		return -1


def downloadVideoList(channel, lastWatched):
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


#MAIN
if len(sys.argv) < 2:
	print("Missing argument: channel name.")
	sys.exit(-1)

channel = sys.argv[1]
filePath = "c:\\dev\\scripts\\ytb\\" + channel + ".txt"

if not path.isfile(filePath):
	#first time accessing this channel; download a list of videos
	print("Downloading video list...")
	videos = downloadVideoList(channel, "")
else:
	#load previously downloaded list of videos
	with open(filePath) as f:
		videos = f.read().splitlines()

	if videos[0] == "watched all":
		#watched all videos; download new ones
		print("Refreshing video list...")
		videos = downloadVideoList(channel, videos[1])

if len(videos) > 0:
	video = videos.pop()
	webbrowser.open("https://www.youtube.com/watch?v=" + video)
	
	#save remaining videos
	if len(videos) == 0:
		videos = ["watched all", video] #remember last watched video
	
	with open(filePath, "w") as f:
		for video in videos:
			f.write(video + "\n")