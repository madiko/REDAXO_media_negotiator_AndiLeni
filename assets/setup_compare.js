/* Media Negotiator – image comparison slider */
(function () {
    'use strict';

    var dragActive = false;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderProbeState(node, ok, label, sub, forceWarning) {
        var iconClass = ok ? 'fa-check-circle text-success' : 'fa-times-circle text-danger';
        var itemClass = 'list-group-item';
        var subClass = 'text-muted';

        if (forceWarning) {
            iconClass = 'fa-info-circle';
            itemClass += ' list-group-item-warning';
            subClass = '';
        }

        node.className = itemClass;
        node.innerHTML = '<i class="fa ' + iconClass + '" aria-hidden="true"></i> '
            + escapeHtml(label)
            + (sub ? ' <small' + (subClass ? ' class="' + subClass + '"' : '') + '>' + escapeHtml(sub) + '</small>' : '');
    }

    function updateDeliverBadge(declaredAvif, declaredWebp) {
        var panel = document.getElementById('mn-deliver-badge');
        var labelNode = document.getElementById('mn-deliver-badge-label');
        var viaNode = document.getElementById('mn-deliver-badge-via');
        if (!panel || !labelNode || !viaNode) {
            return;
        }
        var serverAvif = panel.dataset.serverAvif === '1';
        var serverWebp = panel.dataset.serverWebp === '1';
        var newBadge;

        if (declaredAvif && serverAvif) {
            newBadge = panel.dataset.badgeAvif;
        } else if ((declaredWebp || declaredAvif) && serverWebp) {
            newBadge = panel.dataset.badgeWebp;
        } else {
            newBadge = panel.dataset.badgeOriginal;
        }

        if (newBadge) {
            var isUpgrade = declaredAvif && serverAvif || (declaredWebp || declaredAvif) && serverWebp;
            var thumbs = isUpgrade ? ' <i class="fa-solid fa-thumbs-up text-success"></i>' : '';
            labelNode.innerHTML = newBadge + thumbs;
            viaNode.innerHTML = panel.dataset.viaAccept || '';
        }
    }

    function initImageProbe() {
        var probe = document.getElementById('mn-image-probe');
        var probePixel = document.getElementById('mn-probe-pixel');
        var acceptNode = document.getElementById('mn-probe-accept');
        var avifNode;
        var webpNode;
        var imageUrl;
        var statusUrl;
        var attempts = 0;
        var maxAttempts = 20;
        var pendingText;
        var noResultText;
        var noAvifText;
        var noWebpText;

        if (!probe || !probePixel || !acceptNode || probe.dataset.mnProbeInit === '1') {
            return;
        }

        avifNode = probe.querySelector('[data-probe-avif]');
        webpNode = probe.querySelector('[data-probe-webp]');
        imageUrl = probe.dataset.imageUrl;
        statusUrl = probe.dataset.statusUrl;
        pendingText = probe.dataset.pending || 'checking...';
        noResultText = probe.dataset.noResult || pendingText;
        noAvifText = probe.dataset.noAvif || '';
        noWebpText = probe.dataset.noWebp || '';

        if (!avifNode || !webpNode || !imageUrl || !statusUrl) {
            return;
        }

        probe.dataset.mnProbeInit = '1';

        function pollStatus() {
            attempts += 1;

            fetch(statusUrl, { credentials: 'same-origin' })
                .then(function (response) {
                    return response.json();
                })
                .then(function (payload) {
                    var useWarning;

                    if (!payload || !payload.found) {
                        if (attempts < maxAttempts) {
                            window.setTimeout(pollStatus, 250);
                            return;
                        }

                        acceptNode.textContent = noResultText;
                        renderProbeState(avifNode, false, avifNode.dataset.label || '', noResultText, true);
                        renderProbeState(webpNode, false, webpNode.dataset.label || '', noResultText, true);
                        return;
                    }

                    acceptNode.textContent = payload.accept || '–';
                    useWarning = !payload.declaredAvif && !payload.declaredWebp;

                    renderProbeState(avifNode, !!payload.declaredAvif, avifNode.dataset.label || '', useWarning ? noAvifText : '', useWarning);
                    renderProbeState(webpNode, !!payload.declaredWebp, webpNode.dataset.label || '', useWarning ? noWebpText : '', useWarning);
                    updateDeliverBadge(!!payload.declaredAvif, !!payload.declaredWebp);
                })
                .catch(function () {
                    if (attempts < maxAttempts) {
                        window.setTimeout(pollStatus, 250);
                        return;
                    }

                    acceptNode.textContent = noResultText;
                    renderProbeState(avifNode, false, avifNode.dataset.label || '', noResultText, true);
                    renderProbeState(webpNode, false, webpNode.dataset.label || '', noResultText, true);
                });
        }

        acceptNode.textContent = pendingText;
        probePixel.src = imageUrl + (imageUrl.indexOf('?') >= 0 ? '&' : '?') + '_ts=' + Date.now();
        pollStatus();
    }

    function getParts() {
        var container = document.getElementById('mn-compare');
        if (!container) {
            return null;
        }

        var clipLeft = container.querySelector('.mn-clip-left');
        var imgLeft = container.querySelector('.mn-img-left');
        var imgRight = container.querySelector('.mn-img-right');
        var handle = container.querySelector('.mn-handle');
        var leftSel = document.getElementById('mn-sel-left');
        var rightSel = document.getElementById('mn-sel-right');

        if (!clipLeft || !imgLeft || !imgRight || !handle || !leftSel || !rightSel) {
            return null;
        }

        return {
            container: container,
            clipLeft: clipLeft,
            imgLeft: imgLeft,
            imgRight: imgRight,
            handle: handle,
            leftSel: leftSel,
            rightSel: rightSel
        };
    }

    function syncLeftWidth(parts) {
        parts.imgLeft.style.width = parts.container.offsetWidth + 'px';
    }

    function setPos(parts, ratio) {
        var pos = Math.max(0.02, Math.min(0.98, ratio));
        parts.clipLeft.style.width = (pos * 100) + '%';
        parts.handle.style.left = (pos * 100) + '%';
    }

    function updateLabels(leftOpt, rightOpt) {
        var lbl = document.getElementById('mn-lbl-left');
        var rbr = document.getElementById('mn-lbl-right');
        if (lbl && leftOpt)  { lbl.textContent = leftOpt.textContent.trim(); }
        if (rbr && rightOpt) { rbr.textContent = rightOpt.textContent.trim(); }
    }

    function applySelectedImages() {
        var parts = getParts();
        if (!parts) {
            return;
        }

        var leftOpt = parts.leftSel.options[parts.leftSel.selectedIndex];
        var rightOpt = parts.rightSel.options[parts.rightSel.selectedIndex];

        if (leftOpt && leftOpt.dataset.src) {
            parts.imgLeft.src = leftOpt.dataset.src;
        }
        if (rightOpt && rightOpt.dataset.src) {
            parts.imgRight.src = rightOpt.dataset.src;
        }

        updateLabels(leftOpt, rightOpt);
        syncLeftWidth(parts);
    }

    function jumpTo(parts, clientX) {
        var rect = parts.container.getBoundingClientRect();
        setPos(parts, (clientX - rect.left) / rect.width);
    }

    function initAll() {
        var parts = getParts();
        if (parts) {
            if (parts.container.dataset.mnInit !== '1') {
                parts.container.dataset.mnInit = '1';
                setPos(parts, 0.5);
            }

            applySelectedImages();
        }

        initImageProbe();
    }

    function bindGlobalEvents() {
        if (document.documentElement.dataset.mnCompareGlobalInit === '1') {
            return;
        }
        document.documentElement.dataset.mnCompareGlobalInit = '1';

        document.addEventListener('change', function (e) {
            if (e.target && (e.target.id === 'mn-sel-left' || e.target.id === 'mn-sel-right')) {
                applySelectedImages();
            }
        });

        document.addEventListener('mousedown', function (e) {
            var parts = getParts();
            if (!parts) {
                return;
            }
            if (!e.target.closest('#mn-compare')) {
                return;
            }

            jumpTo(parts, e.clientX);
            dragActive = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            var parts;
            if (!dragActive) {
                return;
            }
            parts = getParts();
            if (!parts) {
                return;
            }
            jumpTo(parts, e.clientX);
        });

        document.addEventListener('mouseup', function () {
            dragActive = false;
        });

        document.addEventListener('touchstart', function (e) {
            var parts;
            if (!e.target.closest('#mn-compare') || e.touches.length === 0) {
                return;
            }
            parts = getParts();
            if (!parts) {
                return;
            }

            jumpTo(parts, e.touches[0].clientX);
            dragActive = true;
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', function (e) {
            var parts;
            if (!dragActive || e.touches.length === 0) {
                return;
            }
            parts = getParts();
            if (!parts) {
                return;
            }

            jumpTo(parts, e.touches[0].clientX);
        }, { passive: true });

        document.addEventListener('touchend', function () {
            dragActive = false;
        });

        window.addEventListener('resize', initAll);
    }

    bindGlobalEvents();

    if (document.readyState !== 'loading') {
        initAll();
    } else {
        document.addEventListener('DOMContentLoaded', initAll);
    }

    if (window.jQuery) {
        window.jQuery(document).on('rex:ready', function () {
            window.setTimeout(initAll, 0);
        });
    }
}());
