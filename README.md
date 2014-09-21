YTB
===

This is a small Python script that downloads a list of all videos on a YouTube channel, opens the oldest video in your browser and saves the rest for later. Every time you call the script it'll open the next video and remove it from the queue.

The script is most useful for channels that have a vast archive of videos, and you want to watch all of them, in order (for example, educational channels like [Periodic Videos](https://www.youtube.com/periodicvideos), which has over 500 published videos). As far as I can tell, YouTube doesn't have a simple feature that would let you watch a channel's video backlog in order. All it offers is a [huge playlist](https://www.youtube.com/watch?v=fBQnhLGT9RM&list=UUtESv1e7ntJaLJYKIO1FoYw) that can't even be sorted from the oldest videos to the newest, and the only way to remember the last watched video is to bookmark the URL in your browser. Then when you want to continue watching the channel you have to open the bookmark, delete it, watch a video (or several), and then make another bookmark. It's a hassle, especially if you don't watch videos in huge bursts, but one or two every now and then.


Usage
------

First, you need to know the channel's username, which you can find out from the URL of its main page, e.g. https://www.youtube.com/user/periodicvideos -> periodicvideos.

Run the script with the username as its only argument: "ytb.py periodicvideos". The first time the script runs it will grab all the videos from the channel, which will take several seconds, before opening the first video in your browser.

When you want to watch the next video, just call "ytb.py periodicvideos" again. You could create a Windows shortcut to make it even easier to run.

When the watch queue becomes empty, the script will refresh it with any new videos that have been added since the previous check.


Credits
--------

* [YouTube Data API (v3)](https://developers.google.com/youtube/v3/)