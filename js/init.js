;(function() {
    if (typeof playerEdisoundInizialized !== 'undefined') {
        return;
    }
    var t = document.createElement("script");
    t.innerHTML = `let playerEdisoundInizialized = true`;
    document.head.appendChild(t);

    const rwmpCtnrEls = document.querySelectorAll(".rwm-podcast-player");
    if(rwmpCtnrEls !== null){
        //const ct = Math.floor(Date.now() / 1000 / (60 * 10) ); // ct = ... cache par min ( si par 1h : ..now() / 1000 / (60 *60) )
        const t = document.createElement("script"); t.type = "text/javascript";
        t.src = `https://cdn.jsdelivr.net/npm/@dailymotion/vast-client@3.3.0/dist/vast-client.min.js`;
        document.body.appendChild(t);

        t.addEventListener('load', () => {

            const loadAmplitudeJS = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                document.body.appendChild(script);
                script.onload = resolve;
                script.onerror = reject;
                script.async = true;
                script.crossorigin = "anonymous";
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/amplitudejs/5.3.2/amplitude.js';
            });

            loadAmplitudeJS.then(() => {
                rwmpCtnrEls.forEach(function(rwmpCtnrEl){
                    if (rwmpCtnrEl.dataset.random != null) {
                        return;
                    }
                    let pStr = '', attr, pId = rwmpCtnrEl.dataset.pid;
                    for(var i = 0; i < rwmpCtnrEl.attributes.length; i++){
                        attr = rwmpCtnrEl.attributes[i];
                        if (attr.nodeName !== 'data-pid' && /^data-/.test(attr.nodeName)) {
                            if(pStr!==''){pStr += '&';}
                            pStr += attr.nodeName.replace(/^data-/,'') + '=' + attr.nodeValue.trim(); } }

                    var s = document.createElement("script");
                    s.type = "text/javascript";
                    s.src = `./js/podcast-${pId}.js?${pStr}`;

                    LoadPlayer(rwmpCtnrEl, s);
                });
            });
        })

        function LoadPlayer(rwmpCtnrEl, s) {
            if ( rwmpCtnrEl.dataset.iframe ){
                console.log( 'Trying to load out of Iframe');

                try{
                    var _element=null;
                    var topIframes=top.document.getElementsByTagName('iframe');
                    for(var i=0;i<topIframes.length;i++){
                        if(topIframes[i].contentWindow===self){
                            _element=topIframes[i];
                        }
                    }
                    if(_element==null){
                        _element = document.currentScript || (function() {
                            var scripts = document.getElementsByTagName('script');
                            return scripts[scripts.length - 1];
                        })();
                    }
                }
                catch(e){console.log(e)}

                if (_element){
                    let newContainer = rwmpCtnrEl.cloneNode();
                    _element.after(newContainer);
                    _element.style.height = "1px";
                    rwmpCtnrEl.remove();
                    top.document.body.appendChild(s);
                }
                else
                    document.body.appendChild(s);
            }
            else {
                document.body.appendChild(s);
            }
        }
    }
})()
