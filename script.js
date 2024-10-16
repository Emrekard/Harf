document.addEventListener('DOMContentLoaded', function() {
    let xp = 0; // Başlangıç XP'si
    let hearts = 5; // Oyuncunun başlangıç canı
    let level = 1;
    let avatarState = "wooden_set.png"; // Başlangıçta odun seti
    let username = ""; // Oyuncunun kullanıcı adı
    let leaderboard = []; // Liderlik tablosu
	let askedSyllables = []; // Sorulmuş heceleri tutan liste
	
    // Cache DOM elements to reduce lookups
    const usernameInput = document.getElementById('usernameInput');
    const createUsernameBtn = document.getElementById('createUsernameBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    const answerInput = document.getElementById('answerInput');
    const leaderboardList = document.getElementById('leaderboardList');
	const xpPerLevel = 200; // Her seviyeyi geçmek için gereken XP
   
   // Kullanıcı adı oluştur
    createUsernameBtn.addEventListener('click', function() {
        const input = usernameInput.value;

        console.log("Button clicked");  // To check if the event fires
        if (input) {
            console.log("Username entered:", input);  // Check the entered username
            username = input;
            alert('Hoş geldin, ' + username + '!');
            document.getElementById('usernameSection').style.display = 'none';
            document.getElementById('gameStartSection').style.display = 'block';  // Harf seçimi alanını görünür yap
        } else {
            alert('Lütfen bir kullanıcı adı girin.');
        }
    });

    // Harf seçimlerini al ve oyunu başlat
    startGameBtn.addEventListener('click', function() {
        const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
        const selectedLetters = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);

        if (selectedLetters.length >= 2) {
            alert('Seçilen harflerle oyuna başlıyorsun: ' + selectedLetters.join(', '));
            document.getElementById("answerSection").style.display = "flex";
            playSyllableAndAsk(selectedLetters);  // Heceyi dinletip seçenekleri göster.
        } else {
            alert('Lütfen en az iki harf seçin!');
        }
    });
	function addXP(amount) {
    xp += amount;
    updateStatus();

    if (xp >= level * xpPerLevel) {
        levelUp();
    }
}

function updateStatus() {
    document.getElementById('xpInfo').textContent = 'XP: ' + xp + ' (Seviye: ' + level + ')';
}

	function getRandomSyllable(letters) {
    let validSyllables = [];

    if (level === 1) {
        // 1. seviyedeki basit heceler
        validSyllables = ["an", "na", "en", "ne", "at", "et", "ta", "te", "in", "it"];
    } else if (level === 2) {
        // 2. seviyedeki daha zor heceler
        validSyllables = ["ni", "ti", "il", "el", "al", "la", "le", "li"];
    }

    // Seçilen harflerle uyumlu heceleri filtrele
    const filteredSyllables = validSyllables.filter(syllable => {
        return syllable.split('').every(letter => letters.includes(letter));
    });

    if (filteredSyllables.length === 0) {
        console.error("Geçerli bir hece bulunamadı.");
        return null;
    }

    return filteredSyllables[Math.floor(Math.random() * filteredSyllables.length)];
}
	

	function getRandomSyllable(letters) {
    let validSyllables = [];
    
    if (level === 1) {
        // 1. seviyede tek sesli heceler
        validSyllables = ["an", "na", "en", "ne", "at", "et", "ta", "te", "in", "it"];
    } else if (level === 2) {
        // 2. seviyede iki sesli heceler
        validSyllables = ["tan", "tel", "nil", "lat", "ten", "lin", "nal"];
    } else if (level === 3) {
        // 3. seviyede üç sesli heceler
        validSyllables = ["antel", "nelti", "laten", "tinal", "linat"];
    }

    // Seçilen harflerle uyumlu heceleri filtrele
    const filteredSyllables = validSyllables.filter(syllable => {
        return syllable.split('').every(letter => letters.includes(letter));
    });

    if (filteredSyllables.length === 0) {
        console.error("Geçerli bir hece bulunamadı.");
        return null;
    }

    return filteredSyllables[Math.floor(Math.random() * filteredSyllables.length)];
}
	function levelUp() {
    level++; // Seviye artır
    alert('Tebrikler! Seviye ' + level + 'e geçtiniz!');
    document.getElementById('xpInfo').textContent = 'XP: ' + xp + ' (Seviye: ' + level + ')';

    // Yeni seviyede hece sayısını artır
    if (level === 2) {
        alert("Seviye 2'deyiz! Artık iki sesli hecelerle sorular geliyor.");
    } else if (level === 3) {
        alert("Seviye 3'deyiz! Artık üç sesli hecelerle sorular geliyor.");
    }

    // Yeni seviyeye uygun soruları sor
    loadNewLevel();
}
	function loadNewLevel() {
    // Yeni seviyede sorulan heceleri sıfırlıyoruz
    askedSyllables = [];

    // Seviye zorluklarına göre hece uzunluğu artırılır
    if (level === 2) {
        alert("Seviye 2: İki sesli heceler sorulacak.");
    } else if (level === 3) {
        alert("Seviye 3: Üç sesli heceler sorulacak.");
    }

    // Yeni seviyeye uygun harflerden sorular üretmeye devam ediyoruz
    const selectedLetters = ["a", "n", "e", "t", "i", "l"]; // Seviye boyunca kullanılacak harfler
    playSyllableAndAsk(selectedLetters);
}

	function updateStatus() {
    document.getElementById('xpInfo').textContent = 'XP: ' + xp + ' (Seviye: ' + level + ')';
}

	function levelUp() {
    level++; // Seviye artır
    alert('Tebrikler! Seviye ' + level + 'e geçtiniz!');
    document.getElementById('xpInfo').textContent = 'XP: ' + xp + ' (Seviye: ' + level + ')';
    
    // Yeni seviyede farklı sorular sorulabilir
    loadNewLevel();
}	
	function playSyllableAndAsk(letters) {
    let syllable = getRandomSyllable(letters);

    // Eğer hece daha önce sorulmuşsa yeni bir tane bulana kadar döngü
    while (askedSyllables.includes(syllable)) {
        syllable = getRandomSyllable(letters);
    }
	 // Yeni heceyi listeye ekle
    askedSyllables.push(syllable);

    if (!syllable) {
        alert("Geçerli bir hece bulunamadı, lütfen farklı harfler seçin.");
        return;
    }

    playSyllable(syllable); // Hecenin sesini dinletiyoruz.
    displayMultipleChoiceOptions(syllable, letters); // Seçenekleri gösteriyoruz.
}

	function loadNewLevel() {
    // Yeni seviyede sorulan heceleri sıfırlıyoruz
    askedSyllables = [];

    // Seviye zorluklarına göre eklemeler yapılabilir
    if (level === 2) {
        // 2. seviyeye özgü yeni sorular veya heceler eklenebilir
        alert("Seviye 2'ye hoş geldiniz! Daha zorlu hecelerle devam edin.");
    }

    // Yeni seviyeye uygun soruları sor
    const selectedLetters = ["a", "n", "e", "t", "i", "l"]; // Yeni seviyede kullanılacak harfler
    playSyllableAndAsk(selectedLetters);
}
    function playSyllableAndAsk(letters) {
        const syllable = getRandomSyllable(letters);
        
        if (!syllable) {
            alert("Geçerli bir hece bulunamadı, lütfen farklı harfler seçin.");
            return;
        }

        playSyllable(syllable);  // Hecenin sesini dinletiyoruz.
        displayMultipleChoiceOptions(syllable, letters);  // Seçenekleri gösteriyoruz.
    }

    function playSyllable(syllable) {
    const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${syllable}&tl=tr&client=tw-ob`);
    audio.playbackRate = 0.8; // Ses hızını %80 yap
    audio.play();
}


    function displayMultipleChoiceOptions(correctSyllable, letters) {
    const options = document.querySelectorAll('.optionButton');
    const wrongSyllables = getWrongSyllables(letters, correctSyllable);

    // Doğru cevabı rastgele bir butona yerleştir
    const correctOptionIndex = Math.floor(Math.random() * 4);
    options[correctOptionIndex].textContent = correctSyllable;

    // Yanlış heceleri diğer butonlara yerleştir
    let wrongIndex = 0;
    for (let i = 0; i < 4; i++) {
        if (i !== correctOptionIndex) {
            options[i].textContent = wrongSyllables[wrongIndex];
            wrongIndex++;
        }
    }

    // Seçenekler görünür hale getir
    document.getElementById('multipleChoiceSection').style.display = 'block';

    // Doğru veya yanlış cevabı kontrol et
    options.forEach((option, index) => {
        option.onclick = function() {
            if (index === correctOptionIndex) {
                alert('Doğru cevap! +50 XP kazandın.');
                addXP(50);
            } else {
                alert('Yanlış cevap, doğru cevap: ' + correctSyllable.toUpperCase());
                removeHeart();
            }
            // Yeni soruya geç
            if (hearts > 0) {
                playSyllableAndAsk(letters);
            }
        };
    });
}


    function gameOver() {
        alert('Oyun bitti! Tüm kalpler tükendi.');
        const restartButton = document.createElement('button');
        restartButton.textContent = "Yeniden Başla";
        restartButton.onclick = function() {
            location.reload();  // Oyunu yeniden başlat
        };
        document.body.appendChild(restartButton);
    }

    function getRandomSyllable(letters) {
        const validSyllables = ["an", "na", "en", "ne", "at", "et", "ta", "te", "in", "it", "ni", "ti", "il", "el", "al", "la", "le", "li"];

        // Seçilen harflerden anlamlı heceler oluştur
        const filteredSyllables = validSyllables.filter(syllable => {
            return syllable.split('').every(letter => letters.includes(letter));
        });

        if (filteredSyllables.length === 0) {
            console.error("Geçerli bir hece bulunamadı.");
            return null;
        }

        return filteredSyllables[Math.floor(Math.random() * filteredSyllables.length)];
    }

    function getWrongSyllables(letters, correctSyllable) {
        const validSyllables = ["an", "na", "en", "ne", "at", "et", "ta", "te", "in", "it", "ni", "ti", "il", "el", "al", "la", "le", "li"];
        let wrongSyllables = validSyllables.filter(syllable => syllable !== correctSyllable);

        // Rastgele 3 yanlış hece seç
        wrongSyllables = wrongSyllables.filter(syllable => syllable.split('').every(letter => letters.includes(letter)));
        while (wrongSyllables.length > 3) wrongSyllables.pop();

        return wrongSyllables;
    }
});
