var xhr = function(url, callback) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function(e){
        callback(this.responseText, e);
    };
    oReq.open("get", url, true);
    oReq.send();
};

var colonSeparateDuration = function(num) { // in seconds
    if (typeof num == "number" && !(Number.isNaN || isNaN)(num)) {
        var minutes = Math.floor(num / 60);
        var seconds = Math.floor(num % 60);
        return "" + minutes + ":" + zpad(seconds, 2);
    } else {
        return "--:--";
    }
};

var zpad = function pad(n, width, z) { // by user Pointy on SO: stackoverflow.com/a/10073788
    z = z || "0";
    n = n + "";
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var cbus = {};

cbus.audio = {
    DEFAULT_JUMP_AMOUNT_BACKWARD: -10,
    DEFAULT_JUMP_AMOUNT_FORWARD: 30,

    element: null,

    setElement: function(elem) {
        if (cbus.audio.element) {
            cbus.audio.pause();
            cbus.audio.element.onseeked = null;
            cbus.audio.element.onloadedmetadata = null;
            cbus.audio.element.onended = null;
        }

        if (cbus.audio.queue.indexOf(elem) !== -1) {
            cbus.audio.queue.splice(cbus.audio.queue.indexOf(elem), 1);
        }

        cbus.audio.element = elem;
        cbus.audio.element.currentTime = 0;

        cbus.audio.element.onseeked = function() {
            cbus.audio.updatePlayerTime();
        };
        cbus.audio.element.onloadedmetadata = function() {
            cbus.audio.updatePlayerTime(true);
        };
        cbus.audio.element.onended = function() {
            cbus.audio.playQueueItem(0);
        };

        var episodeElem = elem.parentElement.parentElement.parentElement.parentElement;

        var episodeTitle = episodeElem.querySelector(".episode_title").textContent;
        var episodeFeedTitle = episodeElem.querySelector(".episode_feed-title").textContent;
        var episodeImageCSS = episodeElem.querySelector(".episode_background").style.backgroundImage;
        var episodeImage = episodeImageCSS.substring(4, episodeImageCSS.length - 1);

        $(".player_time--total").text(colonSeparateDuration(cbus.audio.element.duration));

        document.querySelector("cbus-queue-item").title = episodeTitle;
        document.querySelector("cbus-queue-item").feedTitle = episodeFeedTitle;
        document.querySelector("cbus-queue-item").image = episodeImage;
    },

    updatePlayerTime: function(updateTotalLength) {
        if (cbus.audio.element && !cbus.audio.element.paused) {
            var currentTime = cbus.audio.element.currentTime;
            /* slider */
            var percentage = currentTime / cbus.audio.element.duration;
            $(".player_slider").val(Math.round(1000 * percentage) || 0);

            /* time indicator */
            $(".player_time--now").text(colonSeparateDuration(currentTime));
            if (updateTotalLength === true) {
                $(".player_time--total").text(colonSeparateDuration(cbus.audio.element.duration));
            }
        }
    },
    sliderUpdateInterval: null,

    playQueueItem: function(index) {
        if (cbus.audio.queue[index]) {
            cbus.audio.setElement(cbus.audio.queue[index]);

            $("cbus-queue-item").eq(index).remove();

            cbus.audio.updatePlayerTime(true);
            cbus.audio.play();
        }
    },

    play: function() {
        cbus.audio.element.play();
        $(".player_button--play").html("pause");
        $(".player_time--total")
    },
    pause: function() {
        cbus.audio.element.pause();
        $(".player_button--play").html("play_arrow");
    },
    stop: function() {
        cbus.audio.element.pause();
        cbus.audio.element.currentTime = 0;
    },
    jump: function(amount) {
        cbus.audio.element.currentTime += amount;
    },

    queue: [],
    enqueue: function(elem) {
        cbus.audio.queue.push(elem);

        var episodeData = cbus.getEpisodeData({
            audioElement: elem
        });

        var queueItemElem = document.createElement("cbus-queue-item");

        queueItemElem.title = episodeData.title;
        queueItemElem.feedTitle = episodeData.feed.title;
        queueItemElem.image = episodeData.feed.image;

        $(".player_queue").append(queueItemElem);
    }
};

cbus.audio.sliderUpdateInterval = setInterval(cbus.audio.updatePlayerTime, 500);

cbus.display = function(thing) {
    switch (thing) {
        case "feeds":
            $(".filters_feeds").html("");
            cbus.feeds.forEach(function(feed) {
                $(".filters_feeds").append("<div class='tooltip' title='" + feed.title + "' style='background-image:url(" + feed.image + ")'>\</div>");
            });
            break;
        case "episodes":
            $(".list--episodes").html("");

            for (var i = 0; i < Math.min(112, cbus.episodes.length); i++) {
                var episode = cbus.episodes[i];

                var episodeElem = document.createElement("cbus-episode");

                episodeElem.title = episode.title;
                episodeElem.image = episode.feed.image;
                episodeElem.feedTitle = episode.feed.title;
                episodeElem.url = episode.url;
                episodeElem.description = episode.description;
                episodeElem.dataset.id = episode.id;

                $(".list--episodes").append(episodeElem);
            };

            break;
    }
};

cbus.update = function() {
    $(".list--episodes").html("");
    xhr("update?feeds=" + encodeURIComponent(JSON.stringify(cbus.feeds)), function(r) {
        var feedContents = JSON.parse(r);
        var episodes = [];

        console.log(feedContents);

        Object.keys(feedContents).forEach(function(feedUrl) {
            feedContents[feedUrl].items.forEach(function(episode) {
                var feed = cbus.feeds.filter(function(feed) {
                    return feed.url === feedUrl;
                })[0];

                episodes.push({
                    id: episode.id,
                    url: episode.url,
                    title: episode.title,
                    description: episode.description,
                    date: (new Date(episode.date).getTime() ? new Date(episode.date) : null), // check if date is valid
                    feed: feed
                });
            });
        });

        cbus.episodes = episodes.sort(function(a, b) {
            if (a.date > b.date) return -1;
            if (a.date < b.date) return 1;
            return 0;
        });
        cbus.display("episodes");
    });
};

cbus.getEpisodeElem = function(options) {
    if (options.id || (typeof options.index !== "undefined" && options.index !== null)) {
        var elem = null;

        if (options.id) {
            elem = document.querySelector("cbus-episode[data-id='" + options.id + "']");
        } else { // options.index
            elem = document.querySelectorAll("cbus-episode")[Number(options.index)];
        }

        return elem;
    }
    return false;
};

cbus.getEpisodeData = function(options) {
    if (options.id || (typeof options.index !== "undefined" && options.index !== null) || options.audioElement) {
        var result = null;

        if (options.id) {
            var filteredList = cbus.episodes.filter(function(episode) {
                return episode.id === options.id;
            });

            if (filteredList.length !== 0) {
                result = filteredList[0];
            }
        } else if (options.audioElement) {
            result = cbus.getEpisodeData({
                id: options.audioElement.parentElement.parentElement.parentElement.parentElement.dataset.id
            });
        } else { // options.index
            result = cbus.episodes[Number(options.index)];
        }

        return result;
    }
    return false;
};

cbus.feeds = (localStorage.getItem("cbus_feeds") ?
    JSON.parse(localStorage.getItem("cbus_feeds")).sort(function(a, b) {
        var aTitle = a.title.toLowerCase();
        var bTitle = b.title.toLowerCase();

        if (aTitle < bTitle) return -1;
        if (aTitle > bTitle) return 1;
        return 0;
    })
    : []);

cbus.display("feeds");

$(".filters_control--add-feed").click(function() {
    Ply.dialog("prompt", {
        title: "Add feed",
        form: { title: "Some Random Podcast" }
    }).always(function (ui) {
        if (ui.state) {
            console.log(ui.widget);
            var feedTitle = ui.data.title;
            xhr("feedinfo?term=" + feedTitle, function(res) {
                var json = JSON.parse(res);
                console.log(json);

                var feedInfo = json[0];

                var feedTitle = feedInfo.title;
                var feedImage = feedInfo.image;
                var feedUrl = feedInfo.url;

                var feedAlreadyAdded = false;
                for (var i = 0; i < cbus.feeds.length; i++) {
                    var lfeed = cbus.feeds[i];
                    var lfeedUrl = lfeed.url;
                    if (lfeedUrl === feedUrl) {
                        feedAlreadyAdded = true;
                        break;
                    }
                }

                if (feedAlreadyAdded) {
                    Ply.dialog("alert", "You already have that feed.");
                } else {
                    cbus.feeds.push({
                        url: feedUrl,
                        title: feedTitle,
                        image: feedImage
                    });
                    localStorage.setItem("cbus_feeds", JSON.stringify(cbus.feeds));
                    Ply.dialog("alert", "Added feed.");
                }
            });
        }
    });
});

$(".list--episodes").on("click", function(e) {
    var classList = e.target.classList;
    var audioElem = e.target.parentElement.parentElement.querySelector(".episode_audio_player");
    if (classList.contains("episode_button--play")) {
        cbus.audio.setElement(audioElem);
        cbus.audio.play();
    } else if (classList.contains("episode_button--enqueue")) {
        cbus.audio.enqueue(audioElem);
    }
});

$(".player").on("click", function(e) {
    var classList = e.target.classList;
    if (classList.contains("player_button")) {
        if (classList.contains("player_button--backward")) {
            cbus.audio.jump(cbus.audio.DEFAULT_JUMP_AMOUNT_BACKWARD);
        } else if (classList.contains("player_button--forward")) {
            cbus.audio.jump(cbus.audio.DEFAULT_JUMP_AMOUNT_FORWARD);
        } else if (classList.contains("player_button--play")) {
            if (!cbus.audio.element) {
                if (cbus.audio.queue.length > 0) {
                    cbus.audio.setElement(cbus.audio.queue[0]);
                } else {
                    cbus.audio.setElement($(".episode_audio_player")[0]);
                }
                cbus.audio.play();
            } else if (cbus.audio.element.paused) {
                cbus.audio.play();
            } else {
                cbus.audio.pause();
            }
        } else if (classList.contains("player_button--next")) {
            cbus.audio.playQueueItem(0);
        }
    }
});

$(".player_button--next").on("mouseenter click", function(e) {
    var episodeData = cbus.getEpisodeData({
        audioElement: cbus.audio.queue[0]
    });

    var nextEpisodeString = "Nothing in queue.";
    if (cbus.audio.queue.length !== 0) {
        nextEpisodeString = $("<span><strong>" + episodeData.title + "</strong><br>" + episodeData.feed.title + "</span>");
    }

    $(this).tooltipster("content", nextEpisodeString);
});

$(".player_slider").on("input change", function() {
    var proportion = this.value / this.max;
    cbus.audio.element.currentTime = cbus.audio.element.duration * proportion;
});

$(".filter--time").on("change", function() {
    var timeCategory = this.value;
    $(".episode").each(function(i, elem) {
        var matchableTimes = elem.dataset.time.split(",");
        if (matchableTimes.indexOf(timeCategory) !== -1) {
            elem.classList.remove("hidden");
        } else {
            elem.classList.add("hidden");
        }
    });
});

/* header actions */

$(".header_actions").on("click", function(e) {
    var classList = e.target.classList;
    if (classList.contains("header_action")) {
        if (classList.contains("header_action--show-filters")) {
            document.body.classList.toggle("filters-visible");
            e.target.classList.toggle("md-inactive");
        }
        if (classList.contains("header_action--refresh-episodes")) {
            cbus.update();
        }
    }
});

/* player right buttons */

$(".player_right-buttons").on("click", function(e) {
    var classList = e.target.classList;
    if (classList.contains("player_button")) {
        if (classList.contains("player_button--expand")) {
            var icons = ["arrow_drop_up", "arrow_drop_down"];
            document.body.classList.toggle("player-expanded");
            if (document.body.classList.contains("player-expanded")) {
                $(e.target).text(icons[1]);
            } else {
                $(e.target).text(icons[0]);
            }
        }
    }
});

/* do the thing */

cbus.update();

/* initialize tooltipster */

$(".tooltip").tooltipster({
    theme: "tooltipster-cbus",
    animation: "fadeup",
    speed: 300
});
