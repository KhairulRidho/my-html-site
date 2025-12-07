// Import fungsi-fungsi dari Firebase SDK modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    set, 
    update, 
    onValue, 
    runTransaction, 
    get, 
    push, 
    query,
    orderByChild,
    equalTo
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";

// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyCi1PR0UARB0q3gpQc5V8fCNqR111NYkFo",
    authDomain: "game-d2b39.firebaseapp.com",
    databaseURL: "https://game-d2b39-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "game-d2b39",
    storageBucket: "game-d2b39.firebasestorage.app",
    messagingSenderId: "387148233262",
    appId: "1:387148233262:web:73ec208c3fbdf8971c7dbf",
    measurementId: "G-K0KPBJT8FR"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);


document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Variabel Global
    let playerSide; // 'left' atau 'right'
    let opponentSide; // Sisi lawan
    let gameId; // ID Room Game saat ini
    
    // --- Variabel Game Logic ---
    const shootDamage = 10;
    const respawnTime = 3000;
    const shootCooldown = 1000;
    let isReadyToShoot = true; 
    
    // --- Variabel Gerak ---
    const speed = 15;
    const maxMovementX = 150; 
    const maxMovementY = 50;  

    // 2. Elemen DOM
    const gameContainer = document.querySelector('.game-container');
    const leftElement = document.getElementById('left');
    const rightElement = document.getElementById('right');
    const leftHPText = document.getElementById('leftHPText');
    const rightHPText = document.getElementById('rightHPText');
    const leftHPBar = document.getElementById('leftHPBar');
    const rightHPBar = document.getElementById('rightHPBar');
    const shootLeftButton = document.getElementById('shootLeft');
    const shootRightButton = document.getElementById('shootRight');
    const topStatus = document.getElementById('top');
    
    // 3. Audio (Simulasi)
    const hitSound = new Audio('hit.mp3'); 
    const respawnSound = new Audio('respawn.mp3'); 

    // 4. LOGIKA PENCARIAN & JOIN ROOM (MATCHMAKING)
    async function searchOrCreateGame() {
        topStatus.textContent = 'Mencari Lawan...'; 
        
        const gamesRef = ref(db, 'games');
        const q = query(gamesRef, orderByChild('playerCount'), equalTo(1));

        const snapshot = await get(q);

        if (snapshot.exists()) {
            // Ada room terbuka (Join sebagai Player 2 / 'right')
            snapshot.forEach(gameSnapshot => {
                gameId = gameSnapshot.key;
                playerSide = 'right';
                opponentSide = 'left';
                joinGame(gameId);
                return true; 
            });
        } else {
            // Buat room baru sebagai Player 1 / 'left'
            const newGameRef = push(gamesRef);
            gameId = newGameRef.key; 
            playerSide = 'left';
            opponentSide = 'right';
            createGame(gameId);
        }
        initializeControls(); 
    }

    // Pemain 1: Membuat Room (Status: waiting)
    function createGame(id) {
        set(ref(db, 'games/' + id), {
            playerCount: 1,
            status: 'waiting', 
            left: { hp: 100, x: 0, y: 0 },
            right: { hp: 100, x: 0, y: 0 }
        }).then(() => {
            topStatus.textContent = 'Menunggu Lawan... ID Room: ' + id; 
            listenForGameUpdates(id);
        });
    }

    // Pemain 2: Join Room (Status: ready)
    function joinGame(id) {
        update(ref(db, 'games/' + id), {
            playerCount: 2,
            status: 'ready' 
        }).then(() => {
            topStatus.textContent = 'Lawan ditemukan! Game dimulai.'; 
            listenForGameUpdates(id);
        });
    }

    // 5. LISTENER FIREBASE (Sinkronisasi Status & Posisi)
    function listenForGameUpdates(id) {
        // Tentukan elemen diri sendiri dan lawan
        const myElement = (playerSide === 'left') ? leftElement : rightElement;
        const opponentElement = (opponentSide === 'left') ? leftElement : rightElement;
        
        onValue(ref(db, 'games/' + id), (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) return;

            // Logika Kunci: Jika Status menjadi 'ready', tampilkan lawan.
            if (gameData.status === 'ready') {
                 // 1. Tampilkan Lawan
                 opponentElement.classList.remove('hidden-default');
                 
                 // 2. Perbarui Teks Status
                 if (topStatus.textContent.includes('Menunggu') || topStatus.textContent.includes('Mencari')) {
                     topStatus.textContent = 'Lawan ditemukan! Game dimulai.';
                 }
            } else if (gameData.status === 'waiting') {
                 // Sembunyikan lawan saat status masih menunggu
                 opponentElement.classList.add('hidden-default');
            }

            // Sinkronisasi data dari sisi lawan dan diri sendiri
            const opponentData = gameData[opponentSide];
            const myData = gameData[playerSide];

            // Update HP lawan dan HP sendiri
            updateHP(opponentSide, opponentData.hp);
            updateHP(playerSide, myData.hp);

            // Update Posisi lawan
            opponentElement.style.left = `${opponentData.x}px`;
            opponentElement.style.top = `${opponentData.y}px`;
        });
    }

    // 6. LOGIKA GERAKAN (Sinkronisasi Gerakan)
    function movePlayer(player, direction) {
        if (player !== playerSide) return; 

        const element = (player === 'left') ? leftElement : rightElement;
        
        let currentLeft = parseInt(element.style.left) || 0;
        let currentTop = parseInt(element.style.top) || 0;

        switch (direction) {
            case 'up':
                currentTop = Math.max(-maxMovementY, currentTop - speed);
                break;
            case 'down':
                currentTop = Math.min(maxMovementY, currentTop + speed);
                break;
            case 'left':
                currentLeft = Math.max(-maxMovementX, currentLeft - speed);
                break;
            case 'right':
                currentLeft = Math.min(maxMovementX, currentLeft + speed);
                break;
        }

        element.style.left = `${currentLeft}px`;
        element.style.top = `${currentTop}px`;

        // SINKRONISASI: Update posisi ke Firebase
        update(ref(db, `games/${gameId}/${playerSide}`), {
            x: currentLeft,
            y: currentTop
        });
    }

    // 7. LOGIKA TEMBAKAN & COLLISION
    
    function checkCollision(targetElement, bulletEndX_container, bulletEndY_container) {
        const targetImg = targetElement.querySelector('img');
        const targetImgRect = targetImg.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        
        const bulletArrivalX_doc = bulletEndX_container + containerRect.left;
        const bulletArrivalY_doc = bulletEndY_container + containerRect.top;

        const hitMargin = 5; 
        
        const isCollidingX = bulletArrivalX_doc >= targetImgRect.left + hitMargin && bulletArrivalX_doc <= targetImgRect.right - hitMargin;
        const isCollidingY = bulletArrivalY_doc >= targetImgRect.top + hitMargin && bulletArrivalY_doc <= targetImgRect.bottom - hitMargin;

        return isCollidingX && isCollidingY;
    }

    function createShootEffect(shooter, target, damageCallback) {
        const bullet = document.createElement('div');
        bullet.classList.add('bullet');
        gameContainer.appendChild(bullet);

        const shooterRect = shooter.getBoundingClientRect();
        const targetImg = target.querySelector('img');
        const targetImgRectStart = targetImg.getBoundingClientRect();
        
        const containerRect = gameContainer.getBoundingClientRect();

        let startX = shooterRect.left + shooterRect.width / 2 - containerRect.left;
        let startY = shooterRect.top + shooterRect.height / 3 - containerRect.top;
        
        let endX = targetImgRectStart.left + targetImgRectStart.width / 2 - containerRect.left;
        let endY = targetImgRectStart.top + targetImgRectStart.height / 2 - containerRect.top;

        bullet.style.left = `${startX}px`;
        bullet.style.top = `${startY}px`;

        const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const duration = distance / 1500;

        bullet.style.transition = `transform ${duration}s linear`;
        
        setTimeout(() => {
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            bullet.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            
            setTimeout(() => {
                bullet.remove();
                damageCallback(endX, endY); 
            }, duration * 1000 + 50); 
        }, 10);
    }

    // MENGURANGI HP LAWAN MELALUI FIREBASE (Menggunakan runTransaction)
    function handleRemoteDamage(bulletEndX, bulletEndY) {
        const opponentElement = (opponentSide === 'left') ? leftElement : rightElement;
        
        if (checkCollision(opponentElement, bulletEndX, bulletEndY)) {
            const opponentHPRef = ref(db, `games/${gameId}/${opponentSide}/hp`);
            runTransaction(opponentHPRef, (currentHP) => {
                if (currentHP === null) return 100;
                if (currentHP <= 0) return 0;
                return currentHP - shootDamage;
            });
            hitSound.play(); 
        } else {
            console.log(`${opponentSide.toUpperCase()} berhasil menghindar!`);
        }
    }


    function handleShoot() {
        const correctButtonId = (playerSide === 'left') ? 'shootLeft' : 'shootRight';
        const shootButton = document.getElementById(correctButtonId);

        if (!gameId || !isReadyToShoot || shootButton.disabled) return; 

        const shooterElement = (playerSide === 'left') ? leftElement : rightElement;
        const targetElement = (opponentSide === 'left') ? leftElement : rightElement;

        // Terapkan Cooldown
        isReadyToShoot = false;
        
        shootButton.disabled = true;
        shootButton.textContent = `Reloading... (${shootCooldown/1000}s)`;

        setTimeout(() => {
            isReadyToShoot = true;
            // Cek status game sebelum mengaktifkan lagi
            get(ref(db, 'games/' + gameId + '/status')).then((snapshot) => {
                if (snapshot.val() === 'ready') {
                    shootButton.disabled = false;
                    shootButton.textContent = 'Tembak Lawan';
                }
            });
        }, shootCooldown);

        createShootEffect(shooterElement, targetElement, handleRemoteDamage);
    }
    
    // 8. KONTROL INPUT
    function initializeControls() {
        topStatus.textContent = `Anda adalah Player ${playerSide.toUpperCase()} (${playerSide === 'left' ? 'Panah' : 'WASD'})`;

        // Tampilkan elemen DIRI SENDIRI
        const myElement = (playerSide === 'left') ? leftElement : rightElement;
        myElement.classList.remove('hidden-default');
        
        // Atur tombol tembak yang relevan
        if (playerSide === 'left') {
             shootRightButton.style.display = 'none';
             shootLeftButton.textContent = 'Tembak Kanan';
        } else {
             shootLeftButton.style.display = 'none';
             shootRightButton.textContent = 'Tembak Kiri';
        }

        // Listener Keyboard (Gerakan)
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase(); 

            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's', 'a', 'd'].includes(key)) {
                event.preventDefault(); 
            }

            // Gerakan Player 'left' (Panah)
            if (playerSide === 'left') {
                if (event.key === 'ArrowUp') movePlayer('left', 'up');
                if (event.key === 'ArrowDown') movePlayer('left', 'down');
                if (event.key === 'ArrowLeft') movePlayer('left', 'left');
                if (event.key === 'ArrowRight') movePlayer('left', 'right');
            }
            
            // Gerakan Player 'right' (WASD)
            if (playerSide === 'right') {
                if (key === 'w') movePlayer('right', 'up');
                if (key === 's') movePlayer('right', 'down');
                if (key === 'a') movePlayer('right', 'left');
                if (key === 'd') movePlayer('right', 'right');
            }
        });
        
        shootLeftButton.addEventListener('click', handleShoot); 
        shootRightButton.addEventListener('click', handleShoot); 
    }


    // 9. FUNGSI RESPAWN & Update HP
    function updateHP(target, newHP) {
        let hpElement, hpBarElement, targetElement;

        if (target === 'left') {
            hpElement = leftHPText;
            hpBarElement = leftHPBar;
            targetElement = leftElement;
        } else {
            hpElement = rightHPText;
            hpBarElement = rightHPBar;
            targetElement = rightElement;
        }

        const finalHP = Math.max(0, newHP);
        hpElement.textContent = finalHP;
        hpBarElement.style.width = finalHP + '%';

        if (finalHP > 50) {
            hpBarElement.style.backgroundColor = '#4CAF50'; 
        } else if (finalHP > 20) {
            hpBarElement.style.backgroundColor = '#ffc107'; 
        } else {
            hpBarElement.style.backgroundColor = '#f44336'; 
        }
        
        if (finalHP === 0 && !targetElement.classList.contains('respawning')) {
            handleRespawn(target);
        }
    }

    function handleRespawn(target) {
        respawnSound.play();
        const targetElement = (target === 'left') ? leftElement : rightElement;
        
        targetElement.classList.add('respawning');
        topStatus.textContent = `${target.toUpperCase()} IS RESPAWNING...`;
        
        const shootButton = (playerSide === target) ? document.getElementById(playerSide === 'left' ? 'shootLeft' : 'shootRight') : null;
        if (shootButton) shootButton.disabled = true;

        setTimeout(() => {
            targetElement.classList.remove('respawning');
            
            // Update HP ke 100 melalui Firebase (Hanya dilakukan oleh sisi yang respawn)
            if (target === playerSide) {
                set(ref(db, `games/${gameId}/${playerSide}/hp`), 100);
            }
            
            if (shootButton) shootButton.disabled = false;
            topStatus.textContent = 'Game Ready'; 
        }, respawnTime);
    }
    
    // 10. MULAI GAME
    searchOrCreateGame();
});