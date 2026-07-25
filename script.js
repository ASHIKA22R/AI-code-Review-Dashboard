const ownerInput = document.getElementById("owner");
const repoInput = document.getElementById("repo");

const analyzeBtn = document.getElementById("analyzeBtn");

const dashboard = document.getElementById("dashboard");
const loading = document.getElementById("loading");

const repoName = document.getElementById("repoName");
const repoDesc = document.getElementById("repoDesc");
const repoLang = document.getElementById("repoLang");
const repoStars = document.getElementById("repoStars");
const repoForks = document.getElementById("repoForks");
const repoIssues = document.getElementById("repoIssues");

const reviewResult = document.getElementById("reviewResult");
const score = document.getElementById("score");
const stars = document.getElementById("stars");
const suggestions = document.getElementById("suggestions");

const themeBtn = document.getElementById("themeBtn");

let languageChart;




themeBtn.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    themeBtn.innerHTML = document.body.classList.contains("dark")
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';

});


analyzeBtn.addEventListener("click", analyzeRepository);

async function analyzeRepository() {

    const owner = ownerInput.value.trim();
    const repo = repoInput.value.trim();

    if (!owner || !repo) {
        alert("Enter GitHub username and repository.");
        return;
    }

    // Reset UI before new analysis
    reviewResult.innerHTML = "<p>Repository loaded successfully.</p><p>Waiting for AI review...</p>";
    score.textContent = "0/100";
    stars.textContent = "☆☆☆☆☆";
    suggestions.innerHTML = "";

    dashboard.classList.add("hidden");
    loading.classList.remove("hidden");

    try {

        await loadRepository(owner, repo);
        await loadLanguages(owner, repo);
        await generateAIReview(owner, repo);

    } catch (err) {

        alert(err.message);

    } finally {

        loading.classList.add("hidden");
        dashboard.classList.remove("hidden");

    }

}

async function loadRepository(owner, repo) {

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`
    );

    if (!response.ok) {
        throw new Error("Repository not found.");
    }

    const data = await response.json();

    repoName.textContent = data.full_name;
    repoDesc.textContent = data.description || "No description";
    repoLang.textContent = data.language || "Unknown";
    repoStars.textContent = data.stargazers_count;
    repoForks.textContent = data.forks_count;
    repoIssues.textContent = data.open_issues;

}

async function loadLanguages(owner, repo) {

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/languages`
    );

    if (!response.ok) {
        throw new Error("Unable to fetch repository languages.");
    }

    const languages = await response.json();
    drawLanguageChart(languages);

}

function drawLanguageChart(languages) {

    const labels = Object.keys(languages);
    const values = Object.values(languages);

    if (languageChart) {
        languageChart.destroy();
    }

    const ctx = document.getElementById("languageChart").getContext("2d");

    languageChart = new Chart(ctx, {

        type: "doughnut",

        data: {
            labels,
            datasets: [
                {
                    label: "Languages",
                    data: values,
                    backgroundColor: [
                        "#3B82F6",
                        "#10B981",
                        "#F59E0B",
                        "#EF4444",
                        "#8B5CF6",
                        "#06B6D4",
                        "#F97316",
                        "#14B8A6"
                    ],
                    borderWidth: 1
                }
            ]
        },

        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" }
            }
        }

    });

}

async function generateAIReview(owner, repo) {

    try {

        reviewResult.innerHTML = "Generating AI Review...";

        const response = await fetch("/api/review", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ owner, repo })

        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data.error || "AI Review failed.";
            reviewResult.innerHTML = `<span style="color:red;">❌ Error: ${errMsg}</span>`;
            console.error("Server error:", errMsg);
            return;
        }

        const review = data.review;

        reviewResult.innerHTML = review.replace(/\n/g, "<br>");

        calculateScore(review);

    } catch (error) {

        reviewResult.innerHTML = `<span style="color:red;">❌ Network error: ${error.message}</span>`;
        console.error(error);

    }

}


function calculateScore(review) {

    let value = 85;

    const match = review.match(/\b(\d{2,3})\/100\b/);

    if (match) {
        value = parseInt(match[1]);
    } else {
        const nums = review.match(/\b\d{2,3}\b/g);
        if (nums && nums.length > 0) {
            value = Math.min(100, parseInt(nums[0]));
        }
    }

    value = Math.max(0, Math.min(100, value));

    score.textContent = `${value}/100`;

    updateStars(value);
    generateSuggestions(review);

}

function updateStars(scoreValue) {

    let rating = 1;

    if (scoreValue >= 90) rating = 5;
    else if (scoreValue >= 80) rating = 4;
    else if (scoreValue >= 70) rating = 3;
    else if (scoreValue >= 60) rating = 2;

    stars.innerHTML = "";

    for (let i = 1; i <= 5; i++) {
        stars.innerHTML += i <= rating
            ? '<i class="fa-solid fa-star"></i>'
            : '<i class="fa-regular fa-star"></i>';
    }

}

function generateSuggestions(review) {

    suggestions.innerHTML = "";

    const keywords = [
        "error handling",
        "security",
        "performance",
        "optimization",
        "duplicate",
        "const",
        "async",
        "await",
        "validation",
        "readability"
    ];

    let found = false;

    keywords.forEach(item => {

        if (review.toLowerCase().includes(item)) {

            const li = document.createElement("li");
            li.textContent = "✔ " + item.charAt(0).toUpperCase() + item.slice(1);
            suggestions.appendChild(li);
            found = true;

        }

    });

    if (!found) {

        [
            "Improve code readability",
            "Use async/await consistently",
            "Add proper error handling",
            "Validate all user inputs",
            "Optimize repeated logic"
        ].forEach(text => {

            const li = document.createElement("li");
            li.textContent = "✔ " + text;
            suggestions.appendChild(li);

        });

    }

}


ownerInput.addEventListener("keypress", e => {
    if (e.key === "Enter") analyzeBtn.click();
});

repoInput.addEventListener("keypress", e => {
    if (e.key === "Enter") analyzeBtn.click();
});


function copyReview() {

    navigator.clipboard.writeText(reviewResult.innerText)
        .then(() => alert("Review copied successfully!"))
        .catch(() => alert("Unable to copy review."));

}

function downloadReview() {

    const report = `
===================================

AI CODE REVIEW REPORT

===================================

Repository : ${repoName.textContent}

Score : ${score.textContent}

-----------------------------------

${reviewResult.innerText}

-----------------------------------

Suggestions

${suggestions.innerText}

Generated by

AI Code Review Dashboard

`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "AI_Code_Review_Report.txt";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

}


window.addEventListener("load", () => {

    const reviewCard = reviewResult.parentElement;

    const buttonBox = document.createElement("div");
    buttonBox.className = "review-btn-box";

    const copyBtn = document.createElement("button");
    copyBtn.innerHTML = "📋 Copy Review";
    copyBtn.className = "review-action-btn copy-btn";
    copyBtn.onclick = copyReview;

    const downloadBtn = document.createElement("button");
    downloadBtn.innerHTML = "⬇ Download Report";
    downloadBtn.className = "review-action-btn download-btn";
    downloadBtn.onclick = downloadReview;

    buttonBox.appendChild(copyBtn);
    buttonBox.appendChild(downloadBtn);
    reviewCard.appendChild(buttonBox);

});

console.log("AI Code Review Dashboard Loaded Successfully");