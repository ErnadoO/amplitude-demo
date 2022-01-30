var rwmpVars = {
        adInProgress : false,
        currentIndex: 0,
        adIndex : 0,
        forcePlay : false,
        finalPlaylist : [],
        globalVast : false,
        yknytmzg : false,
        autoplayLunched : false
    }

// Start: isolation du code
;(function(window, rwmpVars, undefined) {
    const rwmpLoadPlayer = (sponsorizedMedias ) => {
        let autoplay = false;

        if( typeof( sponsorizedMedias[0] ) != 'undefined' ){
            if( typeof( sponsorizedMedias[0].autoplay ) != 'undefined' )
                autoplay = sponsorizedMedias[0].autoplay;
        }

        let rwm_trunk_editor_duration = 5, rwm_trunk_editor_duration_init = 5;
        let rwm_trunk_sponso_duration = 1, rwm_trunk_sponso_duration_init = 1;
        let rwm_trunk_step_duration = 61;
        var lastListenedRwmId = null;
        var lastLlistenedRest = 0;

        // Fonction appelée à chaque seconde de lecture
        const mfwOnPlaying = (metadata, playedSeconds) => {
            let isPaid = (metadata.paid !== 'undefined' && metadata.paid === 1);
            let rwmId = metadata.rwm_episode_id;
            let listenId = metadata.listen_id;
            let listenKey = metadata.listen_key;
            let rwm_duration = (isPaid) ? rwm_trunk_sponso_duration : rwm_trunk_editor_duration;

            if( lastListenedRwmId === rwmId ){
                if( (Math.floor(playedSeconds) % rwm_duration) === 0 && !rwmpVars.adInProgress){ // pour réduire le travail
                    let rest = Math.floor(playedSeconds / rwm_duration);
                    //console.log( 'modulo : ' + modulo + ' - rest : ' + rest + ' - rest : ' + lastLlistenedRest );
                    if( rest === (lastLlistenedRest +1) ){
                        let data = {listen_id: listenId, listen_key: listenKey, asset_id: rwmId, seconds: Math.floor(playedSeconds), autoplay: autoplay, uuid: '1ec11851\u002Dc897\u002D647a\u002Da341\u002D853a979ccbde' };

                        fetch('https\u003A\/\/podcast.local\/api\/p\/stats', {
                            method: "POST",
                            body: JSON.stringify(data),
                            headers: new Headers({"Content-Type": "text/plain"})
                        }).then(r => null);
                    }
                    lastLlistenedRest = rest;

                    // toutes les secondes avant la 1ere minute, puis toutes les 5 secondes
                    rwm_trunk_editor_duration = ( !isPaid && Math.floor(playedSeconds) >= rwm_trunk_step_duration ) ? 5 : rwm_trunk_editor_duration_init;
                    rwm_trunk_sponso_duration = ( isPaid && Math.floor(playedSeconds) >= rwm_trunk_step_duration ) ? 5 : rwm_trunk_sponso_duration_init;
                }

                if (rwmpVars.adInProgress) {
                    vastTracker.setProgress(playedSeconds);
                    if (rwmpVars.yknytmzg === true) {

                        if ( !rwmpVars.vastTrackerComplete && playedSeconds > (Amplitude.getSongDuration() / 6) ){
                            vastTracker.track('complete');
                            rwmpVars.vastTrackerComplete = true;
                        }
                    }
                    else
                    {
                        if (Math.floor(Amplitude.getSongPlayedPercentage()) === '0') {
                            vastTracker.setDuration(Amplitude.getSongDuration())
                        }
                    }
                }
            }
            else{
                lastLlistenedRest = 0;
                lastListenedRwmId = rwmId;
            }
        };

        // mix sponsorizedMedias with rwmpSongs
        console.log('sponsorizedMedias', sponsorizedMedias);
        console.log('rwmpSongs', rwmpSongs);

        const sortType = 'each_n';
        const sortTypeEachNumber = 1;
        switch(sortType){
            case 'each_n':
                for (let i = 0; i < rwmpSongs.length; i++) {
                    if( sponsorizedMedias.length > 0 && ( i % sortTypeEachNumber ) === 0 ) {
                        rwmpVars.finalPlaylist.push(sponsorizedMedias.shift());
                    }
                    rwmpVars.finalPlaylist.push(rwmpSongs[i]);
                }
                if( sponsorizedMedias.length > 0 && (i % sortTypeEachNumber) === 0 ) {
                    rwmpVars.finalPlaylist.push(sponsorizedMedias.shift());
                }
                break;
        }
                if(rwmpSongs.length === 0 && sponsorizedMedias.length > 0){
            rwmpVars.finalPlaylist.push(sponsorizedMedias.shift());
        }

        console.log('finalPlaylist', rwmpVars.finalPlaylist);

        // insérer le html du player
        rwmpContainerEl.innerHTML = rwmp_htmlTemplate;

        // Add CSS and AMPLITUDEJS
        let firstPlayClick = true;
        var init_conf = {
            "continue_next": true,
            "debug": true,
            "preload": "none",
            "songs": rwmpVars.finalPlaylist,
            "callbacks": {
                "play": function() {
                    let metadata = Amplitude.getActiveSongMetadata();
                    let topRightEl = rwmpContainerEl.querySelector('.rwm-podcast-player div#player-top-right');
                    let msgEl = rwmpContainerEl.querySelector('.rwm-podcast-player div#player-top-right .msg');

                    if(topRightEl && msgEl){
                        if('paid' in metadata){
                            topRightEl.classList.add("msg-active");
                        } else {
                            topRightEl.classList.remove("msg-active");
                        }
                    }
                },
                "initialized": function(){
                    if ( autoplay ){
                        const podcastAutoplayRetryMax = 10;
                        const podcastAutoplayRetryInterval = setInterval(podcastPlay, 1500);
                        let podcastAutoplayRetry = 1;
                        function podcastPlay(){
                            if (rwmpVars.autoplayLunched === true) {
                                return;
                            }
                            var playButton = rwmpContainerEl.querySelector('#back');
                            var playButton2 = rwmpContainerEl.querySelector('#play-pause');
                            if (playButton !== null && Amplitude.getPlayerState() !== "playing"){
                                playButton.click();
                                playButton2.click();
                                if( Amplitude.getPlayerState() === "playing" || podcastAutoplayRetry >= podcastAutoplayRetryMax) {
                                    rwmpVars.autoplayLunched = true;

                                    clearInterval(podcastAutoplayRetryInterval);
                                }
                                podcastAutoplayRetry++;
                            }
                        }
                    }
                },
                "song_change": function() {
                    Amplitude.setVolume(Amplitude.getVolume());
                    if(!rwmpVars.adInProgress){
                        let styleEl = document.querySelector('#style-rwmp-song-progress-range');
                        if(styleEl){
                            styleEl.innerHTML = ".rwm-podcast-player div#progress-container .disable{display: none;}";
                        }
                        rwmpContainerEl.querySelector('.rwm-podcast-player div#progress-container').style.cursor = "pointer";
                        rwmpContainerEl.querySelector('.rwm-podcast-player div#progress-container input[type=range]').style.cursor = "pointer";
                        let progressDisableEl = rwmpContainerEl.querySelector('.rwm-podcast-player div#progress-container .disable');
                        if(progressDisableEl){
                            progressDisableEl.classList.remove("activate");
                        }
                    }
                },
                "timeupdate": () => {
                    mfwOnPlaying(Amplitude.getActiveSongMetadata(), Amplitude.getSongPlayedSeconds());
                },
                "ended": function(){
                    if (rwmpVars.adInProgress && rwmpVars.adIndex === Amplitude.getActiveIndex()) {
                        rwmpVars.adInProgress = false;
                        Amplitude.removeSong( rwmpVars.adIndex );
                        Amplitude.bindNewElements();
                        rwmpVars.forcePlay = true;
                        Amplitude.playSongAtIndex( rwmpVars.currentIndex );
                        //vastTracker.track('complete');
                    }
                }
            }
        };

        // 4 > Initializes AmplitudeJS
        Amplitude.init(init_conf);
        Amplitude.pause();

        if (typeof rwmpVars.finalPlaylist[0] != 'undefined' && typeof rwmpVars.finalPlaylist[0].metadata.duration != 'undefined') {
            const minutes = Math.floor(rwmpVars.finalPlaylist[0].metadata.duration / 60);
            const seconds = Math.floor(rwmpVars.finalPlaylist[0].metadata.duration % 60);

            rwmpContainerEl.querySelector('#time-container .amplitude-duration-minutes').innerHTML = `${minutes >= 10 ? minutes : '0'+minutes}`;
            rwmpContainerEl.querySelector('#time-container .amplitude-duration-seconds').innerHTML = `${seconds >= 10 ? seconds : '0'+seconds}`;
        }

        // Global Events
        let subscribeButton = rwmpContainerEl.querySelectorAll('.subscribe')
        let backwardButtons = rwmpContainerEl.querySelectorAll('#back');
        let forwardButtons = rwmpContainerEl.querySelectorAll('#forward');
        let prevButtons = rwmpContainerEl.querySelectorAll('.rwm-prev');
        let nextButtons = rwmpContainerEl.querySelectorAll('.rwm-next');
        let playlistSongs = rwmpContainerEl.querySelectorAll('#amplitude-playlist');

        let visibilityTracker = true;

        const skipSeconds = seconds => {
            const duration = Amplitude.getSongDuration()
            const currentTime = parseFloat(Amplitude.getSongPlayedSeconds())
            const targetTime = parseFloat(currentTime + seconds)
            Amplitude.setSongPlayedPercentage((targetTime / duration) * 100)
        }

        if (subscribeButton != null){
            for( var i = 0; i < subscribeButton.length; i++ ){
                subscribeButton[i].addEventListener('click', function(e){
                    window.open(Amplitude.getActiveSongMetadata().frontpage, '_blank');

                    let metadata = Amplitude.getActiveSongMetadata();

                });
            }
        }

        if (backwardButtons != null){
            for( var i = 0; i < backwardButtons.length; i++ ){
                backwardButtons[i].addEventListener('click', function(e){
                    if (rwmpVars.adInProgress === false)
                        skipSeconds(-10);
                });
            }
        }

        if (forwardButtons != null){
            for( var i = 0; i < forwardButtons.length; i++ ){
                forwardButtons[i].addEventListener('click', function(e){
                    if (rwmpVars.adInProgress === false)
                        skipSeconds(+10);
                });
            }
        }

        if (prevButtons != null){
            for( var i = 0; i < prevButtons.length; i++ ){
                prevButtons[i].addEventListener('click', function(e){
                    if (rwmpVars.adInProgress === false) Amplitude.prev();
                });
            }
        }

        if (nextButtons != null){
            for( var i = 0; i < nextButtons.length; i++ ){
                nextButtons[i].addEventListener('click', function(e){
                    if (rwmpVars.adInProgress === false) Amplitude.next();
                });
            }
        }

        playlistSongs.forEach(item => {
            item.addEventListener("click", (e) => {
                if (rwmpVars.adInProgress) {
                    e.stopPropagation();
                }
            }, true);
        })
    };

    // initialisation des variables
    const rwmpSongs = [
  {
	"metadata":{"duration":3622.635146844631,"channel":"joint stereo","audio_size":71265070,"bit_rate":157376.17311436398,"sample_rate":44100},
    "name": "Terrain",
    "artist": "pg.lost",
    "album": "Key",
    "url": "https://521dimensions.com/songs/Terrain-pglost.mp3",
    "cover_art_url": "https://521dimensions.com/img/open-source/amplitudejs/album-art/key.jpg"
  },
  {
	"metadata":{"duration":3622.635146844631,"channel":"joint stereo","audio_size":71265070,"bit_rate":157376.17311436398,"sample_rate":44100},
    "name": "Vorel",
    "artist": "Russian Circles",
    "album": "Guidance",
    "url": "https://521dimensions.com/songs/Vorel-RussianCircles.mp3",
    "cover_art_url": "https://521dimensions.com/img/open-source/amplitudejs/album-art/guidance.jpg"
  }
];
        const rwmp_htmlTemplate = `<div id="widget-container" class="edisound_widget-container bc1">
   <!-- Blue Playlist Container -->
   <div id="amplitude-container">
      <!-- Amplitude Player -->
      <div id="amplitude-player" class="cc5">
         <div id="tools-container-mobile" class="tools-container">
                        <span class="subscribe">
                <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 569.687 510.645">
                    <path class="cc2" d="M151.335,0c81.955,0,105.071,58.84,134.491,77.753C313.145,58.84,336.26,0,420.317,0c81.955,0,147.1,67.245,149.2,151.3,6.3,121.882-203.838,306.808-283.692,359.343C203.871,458.11-4.17,273.185.033,151.3,4.236,67.245,67.278,0,151.335,0Z" transform="translate(0.03 0)" fill-rule="evenodd"/>
                </svg>
             </span>
              <span class="share rwmp-share">
                <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 290.313 272.153">
                  <path class="cc2" d="M286.927,2A9.153,9.153,0,0,0,277.873.635L5.7,109.5a9.066,9.066,0,0,0-.417,16.657l85.444,39.447L281.247,9.054l-154.231,173.3v89.8l64.378-60.077,49.753,22.953a9.37,9.37,0,0,0,3.81.835,9.088,9.088,0,0,0,8.945-7.585l36.29-217.738A9.083,9.083,0,0,0,286.927,2Z" transform="translate(0 -0.001)"/>
                </svg>
              </span>
              <span class="download">
                <svg xmlns="http://www.w3.org/2000/svg" width="25px" height="25px" viewBox="0 0 25 25">
                    <path class="cc2" d="M 18.679688 11.398438 C 18.554688 11.117188 18.277344 10.9375 17.96875 10.9375 L 14.84375 10.9375 L 14.84375 0.78125 C 14.84375 0.351562 14.492188 0 14.0625 0 L 10.9375 0 C 10.507812 0 10.15625 0.351562 10.15625 0.78125 L 10.15625 10.9375 L 7.03125 10.9375 C 6.722656 10.9375 6.445312 11.117188 6.320312 11.398438 C 6.191406 11.675781 6.242188 12 6.441406 12.234375 L 11.910156 18.484375 C 12.054688 18.65625 12.269531 18.753906 12.496094 18.753906 C 12.71875 18.753906 12.933594 18.65625 13.082031 18.484375 L 18.550781 12.238281 C 18.757812 12 18.808594 11.675781 18.679688 11.398438 Z M 18.679688 11.398438 "/>
                    <path class="cc2" d="M 21.09375 18.277344 L 21.09375 20.78125 C 21.09375 21.382812 20.605469 21.871094 20.003906 21.871094 L 4.996094 21.871094 C 4.394531 21.875 3.90625 21.386719 3.90625 20.785156 L 3.90625 18.28125 C 3.90625 17.675781 3.417969 17.1875 2.816406 17.1875 L 1.871094 17.1875 C 1.269531 17.1875 0.78125 17.675781 0.78125 18.277344 L 0.78125 23.4375 C 0.78125 24.300781 1.480469 25 2.34375 25 L 21.566406 25 C 23.03125 25 24.21875 23.8125 24.21875 22.347656 L 24.21875 18.28125 C 24.21875 17.679688 23.730469 17.191406 23.128906 17.191406 L 22.1875 17.191406 C 21.582031 17.1875 21.09375 17.675781 21.09375 18.277344 Z M 21.09375 18.277344 "/>
                </svg>
              </span>
                               </div>
         <div id="player-top-left">
            <img data-amplitude-song-info="cover_art_url"/>
            <svg class="amplitude-play-pause" width="100%" height="100%" viewbox="0 0 60 60" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg">
               <path d="M0 0h60v60H0V0z" fill="none"/>
               <g clip-path="url(#b)">
                  <path class="bc1" d="M43.625 29.803L23.646 17.425C22.189 16.474 21 17.173 21 18.988V43.01c0 1.811 1.188 2.517 2.646 1.561l19.979-12.374s.711-.5.711-1.197c0-.7-.711-1.198-.711-1.198z" fill="#F2F2F2" fill-rule="evenodd"/>
               </g>
            </svg>
         </div>
         <div id="player-top-right">
            <div id="tools-container-desktop" class="tools-container">
                        <span class="subscribe">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="11" viewBox="0 0 569.687 510.645">
                    <path class="cc3" d="M151.335,0c81.955,0,105.071,58.84,134.491,77.753C313.145,58.84,336.26,0,420.317,0c81.955,0,147.1,67.245,149.2,151.3,6.3,121.882-203.838,306.808-283.692,359.343C203.871,458.11-4.17,273.185.033,151.3,4.236,67.245,67.278,0,151.335,0Z" transform="translate(0.03 0)" fill-rule="evenodd"/>
                </svg>
             </span>
             <span class="share rwmp-share">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 290.313 272.153">
                  <path class="cc3" d="M286.927,2A9.153,9.153,0,0,0,277.873.635L5.7,109.5a9.066,9.066,0,0,0-.417,16.657l85.444,39.447L281.247,9.054l-154.231,173.3v89.8l64.378-60.077,49.753,22.953a9.37,9.37,0,0,0,3.81.835,9.088,9.088,0,0,0,8.945-7.585l36.29-217.738A9.083,9.083,0,0,0,286.927,2Z" transform="translate(0 -0.001)"/>
                </svg>
             </span>
               <span class="download">
                <svg xmlns="http://www.w3.org/2000/svg" width="12px" height="12px" viewBox="0 0 12 12" version="1.1">
                    <path class="cc3" style="stroke:none;" d="M 8.96875 5.46875 C 8.90625 5.335938 8.773438 5.25 8.625 5.25 L 7.125 5.25 L 7.125 0.375 C 7.125 0.167969 6.957031 0 6.75 0 L 5.25 0 C 5.042969 0 4.875 0.167969 4.875 0.375 L 4.875 5.25 L 3.375 5.25 C 3.226562 5.25 3.09375 5.335938 3.03125 5.46875 C 2.972656 5.605469 2.996094 5.761719 3.089844 5.875 L 5.714844 8.875 C 5.785156 8.957031 5.890625 9.003906 5.996094 9.003906 C 6.105469 9.003906 6.207031 8.957031 6.277344 8.875 L 8.902344 5.875 C 9.003906 5.761719 9.027344 5.605469 8.96875 5.46875 Z M 8.96875 5.46875 "/>
                    <path class="cc3" style="stroke:none;" d="M 10.125 8.773438 L 10.125 9.976562 C 10.125 10.261719 9.890625 10.496094 9.601562 10.496094 L 2.398438 10.496094 C 2.109375 10.5 1.875 10.265625 1.875 9.976562 L 1.875 8.773438 C 1.875 8.484375 1.640625 8.25 1.351562 8.25 L 0.898438 8.25 C 0.609375 8.25 0.375 8.484375 0.375 8.773438 L 0.375 11.25 C 0.375 11.664062 0.710938 12 1.125 12 L 10.351562 12 C 11.054688 12 11.625 11.429688 11.625 10.726562 L 11.625 8.773438 C 11.625 8.488281 11.390625 8.253906 11.101562 8.253906 L 10.648438 8.253906 C 10.359375 8.25 10.125 8.484375 10.125 8.773438 Z M 10.125 8.773438 "/>
                </svg>
             </span>
                                       </div>
            <div id="meta-container">
               <div class="song-artist-album">
                  <span data-amplitude-song-info="artist" class="song-serie cc3">Episode 1 : Lola Dubini</span>
               </div>
               <div class="msg">sponsorisé</div>
               <div data-amplitude-song-info="name" class="song-name cc4"></div>
            </div>
            <div id="time-container">
               <div id="progress-container">
                  <input type="range" class="amplitude-song-slider" step=".1"/>
                  <progress id="song-played-progress" class="amplitude-song-played-progress bc1"></progress>
               </div>
               <span class="current-time cc3">
             <span class="amplitude-current-minutes" ></span>:<span class="amplitude-current-seconds"></span>
             </span>
               <span class="duration cc4">
             <span class="amplitude-duration-minutes"></span>:<span class="amplitude-duration-seconds"></span>
             </span>
            </div>
            <div id="control-container">
               <div id="central-control-container">
                  <div id="central-controls">
                     <div id="volume-controls">
                        <div class="amplitude-mute amplitude-not-muted">
                           <svg style="display: none;" class="svg edisound_widget-container__not-muted" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 61 48.4" xml:space="preserve">
                         <g>
                            <path class="cc2" d="M30.5,43.2c0,1.1-0.6,2-1.6,2.5c-0.4,0.2-0.8,0.3-1.2,0.3c-0.6,0-1.3-0.2-1.8-0.6L10.8,32.8H2.8
                               C1.2,32.8,0,31.6,0,30V19c0-1.5,1.2-2.8,2.8-2.8h8.1L26,3.7c0.8-0.7,2-0.8,2.9-0.4c1,0.5,1.6,1.4,1.6,2.5L30.5,43.2L30.5,43.2z
                                M41.1,38.9c-0.1,0-0.1,0-0.2,0c-0.7,0-1.4-0.3-2-0.8l-0.4-0.4c-1-1-1.1-2.5-0.3-3.6c2.1-2.8,3.2-6.1,3.2-9.6
                               c0-3.7-1.2-7.2-3.6-10.1c-0.9-1.1-0.8-2.7,0.2-3.7l0.4-0.4c0.6-0.6,1.3-0.9,2.1-0.8c0.8,0,1.5,0.4,2,1c3.3,4,5,8.8,5,14
                               c0,4.8-1.5,9.4-4.4,13.3C42.7,38.4,41.9,38.8,41.1,38.9z M52.6,47.5c-0.5,0.6-1.2,0.9-2,1c0,0-0.1,0-0.1,0c-0.7,0-1.4-0.3-2-0.8
                               l-0.4-0.4c-1-1-1.1-2.6-0.2-3.7c4.5-5.3,6.9-12.1,6.9-19c0-7.2-2.6-14.2-7.4-19.6c-1-1.1-0.9-2.8,0.1-3.8L48,0.8
                               C48.5,0.3,49.2,0,50,0c0.8,0,1.5,0.4,2,0.9c5.8,6.5,9,14.9,9,23.6C61,32.9,58,41.1,52.6,47.5z"/>
                         </g>
                         </svg>
                           <svg style="display: none;" class="svg edisound_widget-container__muted" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 61 48.4" xml:space="preserve">
                         <g>
                            <path class="cc2" d="M30.5,43.2c0,1.1-0.6,2-1.6,2.5c-0.4,0.2-0.8,0.3-1.2,0.3c-0.6,0-1.3-0.2-1.8-0.6L10.8,32.8H2.8
                               C1.2,32.8,0,31.6,0,30V19c0-1.5,1.2-2.8,2.8-2.8h8.1L26,3.7c0.8-0.7,2-0.8,2.9-0.4c1,0.5,1.6,1.4,1.6,2.5L30.5,43.2L30.5,43.2z M36.4,15.8L36.4,15.8l8.4,8.4l-8.4,8.4c-0.7,0.7-0.7,1.8,0,2.5l1.1,1.1c0.7,0.7,1.8,0.7,2.5,0l8.4-8.4
                                  l8.4,8.4c0.7,0.7,1.8,0.7,2.5,0l1.1-1.1c0.7-0.7,0.7-1.8,0-2.5L52,24.2l8.5-8.5c0.7-0.7,0.7-1.8,0-2.5l-1.1-1.1
                                  c-0.7-0.7-1.8-0.7-2.5,0l-8.5,8.5L40,12.2c-0.7-0.7-1.8-0.7-2.5,0l-1.1,1.1C35.7,13.9,35.7,15.1,36.4,15.8z"/>
                         </g>
                         </svg>
                        </div>
                        <input type="range" class="amplitude-volume-slider">
                     </div>
                     <div class="rwm-prev" id="previous">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 493.5 493.5">
                           <path class="cc2" d="M447.1.2C437 .2 426.2 4.3 415 12.1L140.9 201c-17.6 12.2-27.3 28.5-27.3 46.1s9.8 33.9 27.4 46.1l274.3 188.7c11.3 7.8 22.6 11.7 32.6 11.7 10.8 0 18.9-4.4 25.3-13 6.3-8.5 8.7-20.5 8.7-35v-397C482 18.7 469.2.2 447.1.2zM53.1 0H39.9C25 0 11.6 12.1 11.6 27v439.4c0 14.9 13 27.1 27.9 27.1h.5l12.9-.1c14.9 0 28.1-12.2 28.1-27V27C81 12.1 68 0 53.1 0z"/>
                        </svg>
                     </div>
                     <div id="back" class="back">
                        <svg version="1.1" id="Calque_1" width="25" height="25" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"  viewBox="0 0 35.7 40.7" style="enable-background:new 0 0 35.7 40.7;" xml:space="preserve">
                      <path class="cc2" d="M29.7,6c-3.9-3.9-9-6-14.4-6C10.5,0,5.8,1.7,2.1,4.8V1c0-0.5-0.4-1-1.1-1S0,0.5,0,1v6.8c0,0.7,0.5,0.8,1,0.8
                         h6.9C8.5,8.6,9,8.2,9,7.5c0-0.5-0.4-1-1.1-1H3.5C6.8,3.6,11,2,15.4,2c4.9,0,9.5,1.9,12.9,5.3c3.4,3.4,5.3,8,5.3,12.9
                         c0,4.9-1.9,9.5-5.3,12.9c-3.4,3.4-8,5.3-12.9,5.3c-4.9,0-9.5-1.9-12.9-5.3c-0.4-0.4-1.2-0.4-1.6,0c-0.4,0.4-0.4,1.2,0,1.6
                         c3.9,3.9,9,6,14.4,6c5.4,0,10.5-2.1,14.4-6c3.9-3.9,6-9,6-14.4C35.7,14.9,33.6,9.8,29.7,6z"/>
                           <g>
                              <path class="cc2" d="M7.7,14.5C7.9,14.7,8,15,8,15.3v10.9c0,0.3-0.1,0.6-0.4,0.8c-0.2,0.2-0.5,0.3-0.9,0.3S6.1,27.2,5.8,27
                            c-0.2-0.2-0.3-0.5-0.3-0.8v-9l-1.2,0.7c-0.1,0.2-0.3,0.3-0.5,0.3c-0.3,0-0.6-0.1-0.8-0.4S2.7,17.3,2.7,17c0-0.2,0.1-0.4,0.2-0.6
                            C3,16.2,3.1,16.1,3.3,16l2.9-1.7c0.2-0.1,0.5-0.2,0.8-0.2C7.2,14.2,7.4,14.3,7.7,14.5z"/>
                              <path class="cc2" d="M12.5,26.7c-0.8-0.6-1.3-1.4-1.7-2.4s-0.6-2.2-0.6-3.6s0.2-2.5,0.6-3.6c0.4-1,1-1.8,1.7-2.4s1.7-0.8,2.7-0.8
                            s2,0.3,2.7,0.8c0.8,0.6,1.3,1.4,1.7,2.4c0.4,1,0.6,2.2,0.6,3.6s-0.2,2.5-0.6,3.6s-1,1.8-1.7,2.4c-0.8,0.6-1.7,0.9-2.7,0.9
                            S13.2,27.3,12.5,26.7z M17.1,24.2c0.5-0.8,0.7-1.9,0.7-3.4s-0.2-2.6-0.7-3.4s-1.1-1.2-1.9-1.2s-1.4,0.4-1.9,1.2
                            c-0.5,0.8-0.7,1.9-0.7,3.4s0.2,2.6,0.7,3.4s1.1,1.2,1.9,1.2C16,25.3,16.6,24.9,17.1,24.2z"/>
                              <path class="cc2" d="M21.5,25.3c0-0.3,0.2-0.6,0.5-0.8c0.2-0.1,0.4-0.2,0.5-0.2c0.3,0,0.5,0.1,0.8,0.4c0.4,0.4,0.8,0.7,1.2,0.9
                            c0.4,0.2,0.9,0.3,1.5,0.3c1,0,1.5-0.4,1.5-1.1c0-0.4-0.2-0.6-0.5-0.8s-0.9-0.4-1.6-0.6c-0.7-0.2-1.3-0.4-1.8-0.6s-0.9-0.5-1.2-0.9
                            c-0.3-0.4-0.5-1-0.5-1.7c0-0.6,0.2-1.1,0.5-1.6c0.3-0.4,0.8-0.8,1.4-1s1.2-0.4,1.8-0.4s1.3,0.1,1.9,0.4c0.6,0.2,1.1,0.6,1.5,1.1
                            c0.2,0.2,0.2,0.4,0.2,0.7c0,0.3-0.1,0.5-0.4,0.7c-0.2,0.1-0.4,0.2-0.6,0.2c-0.3,0-0.5-0.1-0.7-0.3c-0.2-0.3-0.5-0.5-0.9-0.7
                            s-0.8-0.2-1.2-0.2c-1,0-1.4,0.3-1.4,1c0,0.3,0.1,0.5,0.3,0.7s0.4,0.3,0.7,0.4c0.3,0.1,0.7,0.2,1.1,0.3c0.7,0.2,1.2,0.4,1.7,0.6
                            s0.8,0.5,1.2,0.9c0.3,0.4,0.5,1,0.5,1.6s-0.2,1.2-0.5,1.6c-0.4,0.5-0.8,0.8-1.4,1c-0.6,0.2-1.2,0.4-1.8,0.4c-0.8,0-1.6-0.1-2.3-0.4
                            s-1.3-0.7-1.8-1.3C21.5,25.7,21.5,25.5,21.5,25.3z"/>
                           </g>
                      </svg>
                     </div>
                     <div class="amplitude-play-pause cbc2" id="play-pause">
                        <svg class="svg edisound_widget-container__play" width="69" height="69" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                           <path class="cc5" d="M43.625 29.803L23.646 17.426C22.189 16.474 21 17.173 21 18.988V43.01c0 1.812 1.188 2.518 2.646 1.562l19.979-12.375s.711-.5.711-1.197c0-.7-.711-1.198-.711-1.198z" fill="#888" fill-rule="evenodd"/>
                        </svg>
                        <svg class="svg edisound_widget-container__pause" width="69" height="69" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                           <g fill="none" fill-rule="evenodd">
                              <path class="cc5" d="M40.587 16.61h-4.33a2.19 2.19 0 00-2.188 2.201v23.592c0 1.221.979 2.207 2.188 2.207h4.33a2.193 2.193 0 002.188-2.207V18.811a2.186 2.186 0 00-2.188-2.201zM24.2 16.61h-4.328c-1.211 0-2.193.98-2.193 2.201v23.592c0 1.221.982 2.207 2.193 2.207H24.2a2.195 2.195 0 002.188-2.207V18.811A2.193 2.193 0 0024.2 16.61z" fill="#05308C"/>
                           </g>
                        </svg>
                     </div>
                     <div id="forward" class="forward">
                        <svg version="1.1" id="Calque_1" width="25" height="25" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 35.7 40.7" style="enable-background:new 0 0 35.7 40.7;" xml:space="preserve">
                         <path class="cc2" d="M35.5,0.5C35.4,0.2,35,0,34.7,0c-0.7,0-1.1,0.5-1.1,1v3.8C29.9,1.7,25.3,0,20.4,0C14.9,0,9.8,2.1,6,6
                            c-3.9,3.9-6,9-6,14.4c0,5.4,2.1,10.5,6,14.4c3.9,3.9,9,6,14.4,6s10.5-2.1,14.4-6c0.4-0.4,0.4-1.2,0-1.6c-0.4-0.4-1.2-0.4-1.6,0
                            c-3.4,3.4-8,5.3-12.9,5.3s-9.5-1.9-12.9-5.3C3.9,29.7,2,25.1,2,20.2c0-4.9,1.9-9.5,5.3-12.9S15.4,2,20.2,2c4.4,0,8.6,1.6,12,4.5
                            h-4.5c-0.7,0-1,0.5-1,1c0,0.7,0.5,1.1,1,1.1h6.7c0.7,0,1-0.5,1-1.1V1.1C35.6,0.9,35.6,0.7,35.5,0.5z"/>
                           <g>
                              <path class="cc2" d="M13.9,14.5c0.2,0.2,0.3,0.5,0.3,0.8v10.9c0,0.3-0.1,0.6-0.4,0.8c-0.2,0.2-0.5,0.3-0.9,0.3S12.3,27.2,12,27
                               c-0.2-0.2-0.3-0.5-0.3-0.8v-9l-1.2,0.7c-0.1,0.2-0.3,0.3-0.5,0.3c-0.3,0-0.6-0.1-0.8-0.4S8.8,17.3,8.8,17c0-0.2,0.1-0.4,0.2-0.6
                               c0.1-0.2,0.2-0.3,0.4-0.4l2.9-1.7c0.2-0.1,0.5-0.2,0.8-0.2C13.4,14.2,13.6,14.3,13.9,14.5z"/>
                              <path class="cc2" d="M18.6,26.7c-0.8-0.6-1.3-1.4-1.7-2.4s-0.6-2.2-0.6-3.6s0.2-2.5,0.6-3.6c0.4-1,1-1.8,1.7-2.4s1.7-0.8,2.7-0.8
                               s2,0.3,2.7,0.8c0.8,0.6,1.3,1.4,1.7,2.4c0.4,1,0.6,2.2,0.6,3.6s-0.2,2.5-0.6,3.6s-1,1.8-1.7,2.4c-0.8,0.6-1.7,0.9-2.7,0.9
                               S19.4,27.3,18.6,26.7z M23.2,24.2c0.5-0.8,0.7-1.9,0.7-3.4s-0.2-2.6-0.7-3.4s-1.1-1.2-1.9-1.2s-1.4,0.4-1.9,1.2
                               c-0.5,0.8-0.7,1.9-0.7,3.4s0.2,2.6,0.7,3.4s1.1,1.2,1.9,1.2C22.1,25.3,22.8,24.9,23.2,24.2z"/>
                              <path class="cc2" d="M27.6,25.3c0-0.3,0.2-0.6,0.5-0.8c0.2-0.1,0.4-0.2,0.5-0.2c0.3,0,0.5,0.1,0.8,0.4c0.4,0.4,0.8,0.7,1.2,0.9
                               c0.4,0.2,0.9,0.3,1.5,0.3c1,0,1.5-0.4,1.5-1.1c0-0.4-0.2-0.6-0.5-0.8s-0.9-0.4-1.6-0.6c-0.7-0.2-1.3-0.4-1.8-0.6s-0.9-0.5-1.2-0.9
                               c-0.3-0.4-0.5-1-0.5-1.7c0-0.6,0.2-1.1,0.5-1.6c0.3-0.4,0.8-0.8,1.4-1s1.2-0.4,1.8-0.4s1.3,0.1,1.9,0.4c0.6,0.2,1.1,0.6,1.5,1.1
                               c0.2,0.2,0.2,0.4,0.2,0.7c0,0.3-0.1,0.5-0.4,0.7c-0.2,0.1-0.4,0.2-0.6,0.2c-0.3,0-0.5-0.1-0.7-0.3c-0.2-0.3-0.5-0.5-0.9-0.7
                               s-0.8-0.2-1.2-0.2c-1,0-1.4,0.3-1.4,1c0,0.3,0.1,0.5,0.3,0.7s0.4,0.3,0.7,0.4c0.3,0.1,0.7,0.2,1.1,0.3c0.7,0.2,1.2,0.4,1.7,0.6
                               s0.8,0.5,1.2,0.9c0.3,0.4,0.5,1,0.5,1.6s-0.2,1.2-0.5,1.6c-0.4,0.5-0.8,0.8-1.4,1c-0.6,0.2-1.2,0.4-1.8,0.4c-0.8,0-1.6-0.1-2.3-0.4
                               s-1.3-0.7-1.8-1.3C27.6,25.7,27.6,25.5,27.6,25.3z"/>
                           </g>
                         </svg>
                     </div>
                     <div class="rwm-next" id="next">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 493.5 493.5">
                           <path class="cc2" d="M46.4 493.3c10.1 0 20.9-4.1 32.1-11.9l274.1-188.8c17.6-12.2 27.3-28.5 27.3-46.1s-9.8-33.9-27.4-46.1L78.1 11.7C66.8 4 55.6 0 45.5 0 34.8 0 26.6 4.4 20.2 13c-6.3 8.5-8.7 20.5-8.7 35v397c0 29.8 12.8 48.3 34.9 48.3zM440.4 493.5h13.2c14.9 0 28.3-12.1 28.3-27V27.1c0-14.9-13-27.1-27.9-27.1h-.5l-12.9.1c-14.9 0-28.1 12.2-28.1 27v439.4c.1 14.9 13 27 27.9 27z"/>
                        </svg>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
<div id="amplitude-playlist" class="amplitude-playlist cc5">
                  <span class="title-playlist cc4">Recommandations</span>
                        <div data-amplitude-song-index="0" class="song amplitude-song-container amplitude-play-pause cc3 amplitude-paused">
             <div class="song-now-playing-icon-container cbc3">
                <svg class="svg edisound_widget-container__play" width="32" height="32" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                   <path class="cc5" d="M43.625 29.803L23.646 17.426C22.189 16.474 21 17.173 21 18.988V43.01c0 1.812 1.188 2.518 2.646 1.562l19.979-12.375s.711-.5.711-1.197c0-.7-.711-1.198-.711-1.198z" fill="#888" fill-rule="evenodd"></path>
                </svg>
                <svg class="svg edisound_widget-container__pause" width="32" height="32" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                   <g fill="none" fill-rule="evenodd">
                      <path class="cc5" d="M40.587 16.61h-4.33a2.19 2.19 0 00-2.188 2.201v23.592c0 1.221.979 2.207 2.188 2.207h4.33a2.193 2.193 0 002.188-2.207V18.811a2.186 2.186 0 00-2.188-2.201zM24.2 16.61h-4.328c-1.211 0-2.193.98-2.193 2.201v23.592c0 1.221.982 2.207 2.193 2.207H24.2a2.195 2.195 0 002.188-2.207V18.811A2.193 2.193 0 0024.2 16.61z" fill="#05308C"></path>
                   </g>
                </svg>
             </div>
             <div class="song-meta-data">
                <span title="Terrain" class="song-title">Terrain</span>
                <span class="song-duration cc3">60:22</span>
             </div>
          </div><div data-amplitude-song-index="1" class="song amplitude-song-container amplitude-play-pause cc3 amplitude-paused">
             <div class="song-now-playing-icon-container cbc3">
                <svg class="svg edisound_widget-container__play" width="32" height="32" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                   <path class="cc5" d="M43.625 29.803L23.646 17.426C22.189 16.474 21 17.173 21 18.988V43.01c0 1.812 1.188 2.518 2.646 1.562l19.979-12.375s.711-.5.711-1.197c0-.7-.711-1.198-.711-1.198z" fill="#888" fill-rule="evenodd"></path>
                </svg>
                <svg class="svg edisound_widget-container__pause" width="32" height="32" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                   <g fill="none" fill-rule="evenodd">
                      <path class="cc5" d="M40.587 16.61h-4.33a2.19 2.19 0 00-2.188 2.201v23.592c0 1.221.979 2.207 2.188 2.207h4.33a2.193 2.193 0 002.188-2.207V18.811a2.186 2.186 0 00-2.188-2.201zM24.2 16.61h-4.328c-1.211 0-2.193.98-2.193 2.201v23.592c0 1.221.982 2.207 2.193 2.207H24.2a2.195 2.195 0 002.188-2.207V18.811A2.193 2.193 0 0024.2 16.61z" fill="#05308C"></path>
                   </g>
                </svg>
             </div>
             <div class="song-meta-data">
                <span title="Vorel" class="song-title">Vorel</span>
                <span class="song-duration cc3">60:22</span>
             </div>
          </div></div>
      <div class="playlist-blur"></div>
   </div>
   <div id="widget-footer"></div>
</div>
`;
    
    const rwmpContainerEl = document.querySelector(".rwm-podcast-player[data-pid='1ec11851-c897-647a-a341-853a979ccbde']");

        rwmpContainerEl.classList.add('responsive');
    rwmpContainerEl.classList.add('_inread');
    
    rwmpLoadPlayer([]);

// End: isolation du code
})(this, this.rwmpVars);
