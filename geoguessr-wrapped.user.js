// ==UserScript==
// @name         GeoGuessr Wrapped
// @namespace    https://github.com/lonanche/geoguessr-wrapped
// @version      1.1.2
// @description  Fetch all 2025 games and show top 20 most played maps with image generation
// @author       trausi
// @match        https://www.geoguessr.com/me/activities
// @icon         https://www.geoguessr.com/_next/static/media/favicon.bffdd9d3.png
// @updateURL    https://raw.githubusercontent.com/lonanche/geoguessr-wrapped/main/geoguessr-wrapped.user.js
// @downloadURL  https://raw.githubusercontent.com/lonanche/geoguessr-wrapped/main/geoguessr-wrapped.user.js
// @supportURL   https://github.com/lonanche/geoguessr-wrapped/issues
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    async function fetchWithCredentials(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    async function fetchAll2025Games(progressCallback) {
        const mapCounts = {};
        let totalGames = 0;
        let paginationToken = null;
        let foundPre2025 = false;
        let pageCount = 0;

        try {
            while (!foundPre2025) {
                const url = new URL('https://www.geoguessr.com/api/v4/feed/private');
                if (paginationToken) {
                    url.searchParams.append('paginationToken', paginationToken);
                }

                const data = await fetchWithCredentials(url.toString());
                paginationToken = data.paginationToken;
                pageCount++;

                data.entries.forEach(entry => {
                    try {
                        if (entry.type !== 7) return;

                        const payloadJson = JSON.parse(entry.payload);
                        const payloadArray = Array.isArray(payloadJson) ? payloadJson : [payloadJson];

                        payloadArray.forEach(payload => {
                            if (payload.type === 1 && payload.payload) {
                                const gameData = payload.payload;
                                const gameDate = new Date(payload.time || entry.time || '');

                                if (gameDate.getFullYear() < 2025) {
                                    foundPre2025 = true;
                                    return;
                                }

                                if (gameDate.getFullYear() === 2025 &&
                                    gameData.gameMode === 'Standard' &&
                                    gameData.mapSlug &&
                                    gameData.mapName) {

                                    // Use mapSlug as the unique identifier to handle renamed maps
                                    const mapId = gameData.mapSlug;

                                    if (!mapCounts[mapId]) {
                                        // First time seeing this map (from newest to oldest)
                                        // So this is the most recent name
                                        mapCounts[mapId] = {
                                            mapSlug: gameData.mapSlug,
                                            mapName: gameData.mapName,
                                            count: 0
                                        };
                                    }
                                    // Don't update mapName if we already have it (keep the newest name)
                                    mapCounts[mapId].count++;
                                    totalGames++;
                                }
                            }
                        });
                    } catch (error) {
                        // Skip malformed entries
                    }
                });

                if (progressCallback) {
                    progressCallback({
                        totalGames,
                        pageCount,
                        uniqueMaps: Object.keys(mapCounts).length
                    });
                }

                if (!paginationToken || foundPre2025) {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const sortedMaps = Object.values(mapCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 30);

            return {
                totalGames,
                top30Maps: sortedMaps,
                uniqueMaps: Object.keys(mapCounts).length,
                allMaps: Object.values(mapCounts).sort((a, b) => b.count - a.count)
            };

        } catch (error) {
            throw error;
        }
    }

    function add2025MapAnalysisUI() {
        const activitiesHeading = document.querySelector('h1.headline_heading__2lf9L');

        if (!activitiesHeading || !activitiesHeading.textContent.includes('Activities')) {
            return;
        }

        if (document.querySelector('.map-2025-container')) {
            return;
        }

        const container = document.createElement('div');
        container.className = 'map-2025-container';
        container.style.cssText = `
            margin: 32px 0;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 10px 40px rgba(0,0,0,0.08);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e5e7eb;
            gap: 24px;
        `;

        const title = document.createElement('h2');
        title.textContent = 'GeoGuessr Wrapped 2025';
        title.style.cssText = `
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            letter-spacing: -0.025em;
        `;

        const loadButton = document.createElement('button');
        loadButton.className = 'load-2025-button';
        loadButton.textContent = 'Start';
        loadButton.style.cssText = `
            padding: 12px 24px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: #fff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
            letter-spacing: 0.015em;
        `;

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.style.cssText = `
            display: none;
            margin: 32px 0;
            padding: 24px;
            background: #f9fafb;
            border-radius: 12px;
        `;

        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.style.cssText = `
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 12px;
            font-weight: 500;
        `;

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 6px;
            background: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        `;

        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 6px;
            width: 0%;
            transition: width 0.3s ease;
            box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
        `;

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressText);
        progressContainer.appendChild(progressBar);

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'results-2025-container';
        resultsContainer.style.cssText = `
            display: none;
        `;

        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            display: flex;
            gap: 24px;
            margin-bottom: 40px;
        `;

        const tableControls = document.createElement('div');
        tableControls.style.cssText = `
            display: none;
            margin-bottom: 16px;
            align-items: center;
            gap: 12px;
        `;

        const showAllLabel = document.createElement('label');
        showAllLabel.style.cssText = `
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
        `;
        showAllLabel.textContent = 'Show all maps:';

        const showAllCheckbox = document.createElement('input');
        showAllCheckbox.type = 'checkbox';
        showAllCheckbox.className = 'show-all-checkbox';
        showAllCheckbox.style.cssText = `
            width: 16px;
            height: 16px;
            accent-color: #3b82f6;
        `;

        const mapCountLabel = document.createElement('label');
        mapCountLabel.style.cssText = `
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
            margin-left: 24px;
        `;
        mapCountLabel.textContent = 'Maps in image:';

        const mapCountInput = document.createElement('input');
        mapCountInput.type = 'number';
        mapCountInput.className = 'map-count-input';
        mapCountInput.value = '15';
        mapCountInput.min = '1';
        mapCountInput.max = '20';
        mapCountInput.style.cssText = `
            width: 60px;
            padding: 4px 8px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 13px;
            text-align: center;
        `;

        const generateImageButton = document.createElement('button');
        generateImageButton.className = 'generate-image-button';
        generateImageButton.textContent = 'Generate Image';
        generateImageButton.style.cssText = `
            padding: 8px 16px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
            margin-left: auto;
        `;

        tableControls.appendChild(showAllLabel);
        tableControls.appendChild(showAllCheckbox);
        tableControls.appendChild(mapCountLabel);
        tableControls.appendChild(mapCountInput);
        tableControls.appendChild(generateImageButton);

        const mapsTable = document.createElement('div');
        mapsTable.className = 'maps-table';
        mapsTable.style.cssText = `
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            max-height: 600px;
            overflow-y: auto;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        `;

        header.appendChild(title);
        header.appendChild(loadButton);
        container.appendChild(header);
        container.appendChild(progressContainer);
        container.appendChild(resultsContainer);
        resultsContainer.appendChild(statsContainer);
        resultsContainer.appendChild(tableControls);
        resultsContainer.appendChild(mapsTable);

        let allMapsData = null;

        loadButton.addEventListener('mouseenter', () => {
            if (!loadButton.disabled) {
                loadButton.style.transform = 'translateY(-1px)';
                loadButton.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.3)';
            }
        });

        loadButton.addEventListener('mouseleave', () => {
            if (!loadButton.disabled) {
                loadButton.style.transform = 'translateY(0)';
                loadButton.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)';
            }
        });

        generateImageButton.addEventListener('mouseenter', () => {
            if (!generateImageButton.disabled) {
                generateImageButton.style.transform = 'translateY(-1px)';
                generateImageButton.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }
        });

        generateImageButton.addEventListener('mouseleave', () => {
            if (!generateImageButton.disabled) {
                generateImageButton.style.transform = 'translateY(0)';
                generateImageButton.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)';
            }
        });

        loadButton.addEventListener('click', async () => {
            loadButton.disabled = true;
            loadButton.textContent = 'Analyzing...';
            loadButton.style.opacity = '0.7';
            loadButton.style.transform = 'scale(0.98)';
            progressContainer.style.display = 'block';
            resultsContainer.style.display = 'none';

            try {
                const result = await fetchAll2025Games((progress) => {
                    progressText.textContent = `Fetching games • ${progress.totalGames} found • ${progress.uniqueMaps} maps`;
                    progressFill.style.width = `${Math.min((progress.pageCount / 50) * 100, 95)}%`;
                });

                allMapsData = result;

                progressFill.style.width = '100%';

                setTimeout(() => {
                    progressContainer.style.display = 'none';

                    statsContainer.innerHTML = `
                        <div style="flex: 1; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; border: 1px solid #bae6fd;">
                            <div style="font-size: 40px; font-weight: 800; color: #0369a1; letter-spacing: -0.03em; margin-bottom: 8px;">${result.totalGames.toLocaleString()}</div>
                            <div style="font-size: 13px; color: #0c4a6e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Games</div>
                        </div>
                        <div style="flex: 1; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 24px; border-radius: 12px; border: 1px solid #86efac;">
                            <div style="font-size: 40px; font-weight: 800; color: #14532d; letter-spacing: -0.03em; margin-bottom: 8px;">${result.uniqueMaps}</div>
                            <div style="font-size: 13px; color: #14532d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Unique Maps</div>
                        </div>
                    `;

                    let tableHTML = `
                        <div style="padding: 20px 20px 16px 20px; border-bottom: 1px solid #e5e7eb;">
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #111827;">Top 30 Maps</h3>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
                                    <th style="text-align: left; padding: 16px 20px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Rank</th>
                                    <th style="text-align: left; padding: 16px 20px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Map</th>
                                    <th style="text-align: right; padding: 16px 20px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Plays</th>
                                    <th style="text-align: right; padding: 16px 20px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    function renderTable(showAll = false) {
                        const mapsToShow = showAll ? result.allMaps : result.top30Maps;
                        let tableBodyHTML = '';

                        mapsToShow.forEach((map, index) => {
                            const percentage = ((map.count / result.totalGames) * 100).toFixed(1);
                            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                            const rankColor = index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#f87171' : '#6b7280';

                            tableBodyHTML += `
                                <tr style="background: ${bgColor}; transition: all 0.15s; border-bottom: 1px solid #f3f4f6;"
                                    onmouseover="this.style.background='#f0f9ff'; this.style.transform='scale(1.01)'"
                                    onmouseout="this.style.background='${bgColor}'; this.style.transform='scale(1)'">
                                    <td style="padding: 16px 20px; font-size: 14px; color: ${rankColor}; font-weight: 600;">${index + 1}</td>
                                    <td style="padding: 16px 20px; font-size: 14px; color: #111827; font-weight: ${index < 3 ? '600' : '500'};">${map.mapName}</td>
                                    <td style="padding: 16px 20px; text-align: right; font-size: 14px; color: #111827; font-weight: 600;">${map.count}</td>
                                    <td style="padding: 16px 20px; text-align: right; font-size: 13px; color: #6b7280; font-weight: 500;">${percentage}%</td>
                                </tr>
                            `;
                        });

                        return tableBodyHTML;
                    }

                    const initialTableBody = renderTable(false);

                    tableHTML += initialTableBody + `
                            </tbody>
                        </table>
                    `;

                    mapsTable.innerHTML = tableHTML;
                    tableControls.style.display = 'flex';
                    resultsContainer.style.display = 'block';

                    showAllCheckbox.addEventListener('change', (e) => {
                        const showAll = e.target.checked;
                        const newTableBody = renderTable(showAll);
                        const tbody = mapsTable.querySelector('tbody');
                        if (tbody) {
                            tbody.innerHTML = newTableBody;
                        }

                        const titleText = showAll ? `All ${result.uniqueMaps} Maps` : 'Top 30 Maps';
                        const titleElement = mapsTable.querySelector('h3');
                        if (titleElement) {
                            titleElement.textContent = titleText;
                        }
                    });

                    generateImageButton.addEventListener('click', async () => {
                        generateImageButton.disabled = true;
                        generateImageButton.textContent = 'Generating...';
                        generateImageButton.style.opacity = '0.6';

                        try {
                            const mapCount = Math.min(Math.max(parseInt(mapCountInput.value) || 15, 1), 20);
                            const imageDataURL = await generateImageFromTopMaps(result.allMaps, result.totalGames, mapCount);

                            // Create download link
                            const link = document.createElement('a');
                            link.download = 'geoguessr-wrapped-2025.png';
                            link.href = imageDataURL;

                            // Trigger download
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);

                            generateImageButton.textContent = 'Downloaded!';
                            generateImageButton.style.opacity = '1';

                            setTimeout(() => {
                                generateImageButton.disabled = false;
                                generateImageButton.textContent = 'Generate Image';
                            }, 2000);
                        } catch (error) {
                            console.error('Error generating image:', error);
                            generateImageButton.textContent = 'Error';
                            generateImageButton.style.opacity = '1';

                            setTimeout(() => {
                                generateImageButton.disabled = false;
                                generateImageButton.textContent = 'Generate Image';
                            }, 2000);
                        }
                    });

                    loadButton.textContent = 'Refresh Data';
                    loadButton.disabled = false;
                    loadButton.style.opacity = '1';
                    loadButton.style.transform = 'scale(1)';
                }, 500);

            } catch (error) {
                progressContainer.style.display = 'none';
                loadButton.textContent = 'Error - Retry';
                loadButton.style.opacity = '1';
                loadButton.style.transform = 'scale(1)';
                loadButton.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

                setTimeout(() => {
                    loadButton.disabled = false;
                    loadButton.textContent = 'Start';
                    loadButton.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                }, 3000);

                console.error('Error fetching 2025 games:', error);
            }
        });

        activitiesHeading.insertAdjacentElement('afterend', container);
    }

    function init() {
        if (window.location.href.includes('/me/activities')) {
            let attempts = 0;
            const maxAttempts = 15;
            const retryDelay = 500;

            const tryAddUI = () => {
                attempts++;
                add2025MapAnalysisUI();

                if (document.querySelector('.map-2025-container')) {
                    return true;
                } else if (attempts < maxAttempts) {
                    setTimeout(tryAddUI, retryDelay);
                }
            };

            setTimeout(tryAddUI, 100);
        }
    }

    let initComplete = false;

    function tryInit() {
        if (initComplete) return;
        init();
        initComplete = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    let lastUrl = window.location.href;
    const checkUrlChange = () => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            initComplete = false;
            setTimeout(tryInit, 500);
        }
    };

    setInterval(checkUrlChange, 1000);

    function generateImageFromTopMaps(mapsData, totalGames, mapCount = 15) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            // Dynamic height based on map count
            const baseHeight = 200;
            const lineHeight = 50;
            const footerHeight = 80;
            canvas.height = baseHeight + (mapCount * lineHeight) + footerHeight;
            const ctx = canvas.getContext('2d');

            // Set up GeoGuessr-themed gradient background (matching their purple theme)
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#171235'); // --ds-color-purple-100
            gradient.addColorStop(0.5, '#211a4c'); // --ds-color-purple-90
            gradient.addColorStop(1, '#10101c'); // towards black
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Header section with GeoGuessr branding colors
            ctx.fillStyle = 'rgba(255,255,255,1)';
            ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GeoGuessr Wrapped 2025', canvas.width / 2, 60);

            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`Top ${mapCount} Most Played Maps`, canvas.width / 2, 90);

            // Total games stat
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(`${totalGames} Games Played`, canvas.width / 2, 130);

            // Draw selected number of maps
            const topMaps = mapsData.slice(0, mapCount);
            let yPosition = 180;
            const leftMargin = 60;
            const rightMargin = 60;
            const maxTextWidth = canvas.width - leftMargin - rightMargin - 100;

            topMaps.forEach((map, index) => {
                const percentage = ((map.count / totalGames) * 100).toFixed(1);

                // Circular rank background with GeoGuessr theme
                const rankColor = index === 0 ? '#fbbf24' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'rgba(255,255,255,0.15)';
                const circleRadius = 18;
                const circleX = leftMargin + 10;
                const circleY = yPosition - 12;

                // Draw circular background
                ctx.fillStyle = rankColor;
                ctx.beginPath();
                ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
                ctx.fill();

                // Add subtle glow effect for top 3
                if (index < 3) {
                    ctx.shadowColor = rankColor;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(circleX, circleY, circleRadius - 2, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Rank number
                ctx.fillStyle = index < 3 ? '#171235' : 'rgba(255,255,255,0.9)';
                ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText((index + 1).toString(), circleX, circleY + 5);

                // Map name (truncate if too long) - made bigger
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.font = index < 3 ? 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'left';

                let mapName = map.mapName;
                if (ctx.measureText(mapName).width > maxTextWidth) {
                    while (ctx.measureText(mapName + '...').width > maxTextWidth && mapName.length > 10) {
                        mapName = mapName.slice(0, -1);
                    }
                    mapName += '...';
                }
                ctx.fillText(mapName, leftMargin + 40, yPosition - 5);

                // Play count - slightly bigger
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`${map.count}`, canvas.width - rightMargin, yPosition - 10);

                // Percentage - bigger and closer
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.fillText(`${percentage}%`, canvas.width - rightMargin, yPosition + 8);

                yPosition += lineHeight;
            });

            // Footer
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Generated by GeoGuessr Wrapped Script by trausi', canvas.width / 2, canvas.height - 30);

            // Convert to data URL with JPEG compression for smaller file size
            const dataURL = canvas.toDataURL('image/jpeg', 0.9); // 90% quality for good balance
            resolve(dataURL);
        });
    }

    window.fetch2025Games = fetchAll2025Games;

})();