const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => […document.querySelectorAll(selector)];

const repoForm = $(”#repo-form”);
const repoInput = $(”#repo-url”);
const repoStatus = $(”#repo-status”);
const repoResult = $(”#repo-result”);

function setStatus(message) {
if (repoStatus) repoStatus.textContent = message;
}

function getRepositorySlug(value) {
try {
const url = new URL(value.trim());

if (url.hostname.toLowerCase() !== "github.com") {
  return null;
}
const parts = url.pathname.split("/").filter(Boolean);
if (parts.length < 2) return null;
const owner = parts[0];
const repo = parts[1].replace(/\.git$/i, "");
if (
  !/^[a-zA-Z0-9-]+$/.test(owner) ||
  !/^[a-zA-Z0-9._-]+$/.test(repo)
) {
  return null;
}
return { owner, repo };

} catch {
return null;
}
}

async function checkRepository(event) {
event.preventDefault();

const slug = getRepositorySlug(repoInput?.value || “”);

if (!slug) {
setStatus(“Enter a valid public GitHub repository URL.”);
if (repoResult) repoResult.classList.add(“hidden”);
return;
}

if (!repoResult) return;

setStatus(“Checking repository…”);
repoResult.classList.add(“hidden”);

const apiUrl =
https://api.github.com/repos/ +
${encodeURIComponent(slug.owner)}/ +
${encodeURIComponent(slug.repo)};

try {
const response = await fetch(apiUrl, {
headers: { Accept: “application/vnd.github+json” }
});

if (response.status === 404) {
  setStatus("Repository not found, or it is private.");
  return;
}
if (response.status === 403 || response.status === 429) {
  setStatus("GitHub's API rate limit may have been reached. Try again later.");
  return;
}
if (!response.ok) {
  throw new Error("GitHub API request failed.");
}
const repository = await response.json();
if (repository.private) {
  setStatus("This tool is designed for public repositories.");
  return;
}
const contentsResponse = await fetch(
  `${apiUrl}/contents`,
  { headers: { Accept: "application/vnd.github+json" } }
);
if (!contentsResponse.ok) {
  throw new Error("Could not read the repository's root files.");
}
const contents = await contentsResponse.json();
const fileNames = new Set(
  contents.map((item) => item.name.toLowerCase())
);
const checks = [
  {
    label: "README",
    found: [...fileNames].some(
      (name) => /^readme(\.|$)/i.test(name)
    )
  },
  {
    label: "CONTRIBUTING guide",
    found: [...fileNames].some(
      (name) => /^contributing(\.|$)/i.test(name)
    )
  },
  {
    label: "Code of conduct",
    found: [...fileNames].some(
      (name) => /^code_of_conduct(\.|$)/i.test(name)
    )
  },
  {
    label: "License",
    found: [...fileNames].some(
      (name) => /^license(\.|$)/i.test(name) ||
        /^licence(\.|$)/i.test(name)
    )
  }
];
const checksList = $("#repo-checks");
if (checksList) {
  checksList.replaceChildren();
  checks.forEach((check) => {
    const item = document.createElement("li");
    const status = document.createElement("span");
    const label = document.createElement("span");
    status.className =
      `check-status ${check.found ? "pass" : "fail"}`;
    status.textContent = check.found ? "✓" : "!";
    status.setAttribute("aria-hidden", "true");
    label.textContent =
      `${check.label}: ${check.found ? "Found" : "Not found"}`;
    item.append(status, label);
    checksList.append(item);
  });
}
const repoName = $("#repo-name");
const repoDescription = $("#repo-description");
const repoLink = $("#repo-link");
if (repoName) {
  repoName.textContent = repository.full_name;
}
if (repoDescription) {
  repoDescription.textContent =
    repository.description || "No repository description provided.";
}
if (repoLink) {
  repoLink.href = repository.html_url;
  repoLink.textContent = "Open repository on GitHub";
}
repoResult.classList.remove("hidden");
setStatus("Repository check complete.");

} catch (error) {
console.error(error);
setStatus(
“Unable to check this repository right now. Check your connection and try again.”
);
}
}

repoForm?.addEventListener(“submit”, checkRepository);

// Contribution idea filters
$$(”[data-filter]”).forEach((button) => {
button.addEventListener(“click”, () => {
const selected = button.dataset.filter;

$$("[data-filter]").forEach((item) => {
  item.classList.toggle("active", item === button);
  item.setAttribute(
    "aria-pressed",
    String(item === button)
  );
});
$$(".idea-card[data-category]").forEach((card) => {
  const show =
    selected === "all" ||
    card.dataset.category === selected;
  card.classList.toggle("hidden", !show);
});

});
});

// Beginner checklist progress
const checklistItems = $$(”.beginner-check”);
const progressText = $(”#checklist-progress”);

function updateProgress() {
if (!progressText) return;

const completed = checklistItems.filter(
(item) => item.checked
).length;

progressText.textContent =
${completed} of ${checklistItems.length} steps completed;
}

checklistItems.forEach((item) => {
item.addEventListener(“change”, updateProgress);
});

updateProgress();

// Contributing guide generator
const guideForm = $(”#guide-form”);
const guideOutput = $(”#guide-output”);
const copyGuideButton = $(”#copy-guide”);

guideForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const projectName =
$(”#project-name”)?.value.trim() || “My Project”;

const repositoryUrl =
$(”#project-repository”)?.value.trim() || “”;

const contact =
$(”#project-contact”)?.value.trim() ||
“Open a GitHub issue”;

const safeName = projectName.replace(/[\r\n]/g, “ “);

const markdown = [
# Contributing to ${safeName},
“”,
“Thank you for your interest in contributing!”,
“”,
“## How to contribute”,
“”,
“1. Read the project’s README and existing guidelines.”,
“2. Check open issues or propose a useful improvement.”,
“3. Fork the repository and create a descriptive branch.”,
“4. Make your changes and test them.”,
“5. Submit a pull request explaining what you changed.”,
“”,
“## Contribution guidelines”,
“”,
“- Keep changes focused and easy to review.”,
“- Use clear commit messages.”,
“- Be respectful and constructive in discussions.”,
“- Do not submit secrets, passwords, or private information.”,
“”,
“## Questions”,
“”,
contact,
“”,
…(repositoryUrl
? [Repository: ${repositoryUrl}, “”]
: []),
“Thank you for helping improve this project!”
].join(”\n”);

if (guideOutput) guideOutput.value = markdown;
});

copyGuideButton?.addEventListener(“click”, async () => {
if (!guideOutput?.value) return;

try {
await navigator.clipboard.writeText(guideOutput.value);
copyGuideButton.textContent = “Copied!”;

setTimeout(() => {
  copyGuideButton.textContent = "Copy guide";
}, 1500);

} catch {
guideOutput.focus();
guideOutput.select();
setStatus(“Select the guide text and copy it manually.”);
}
});
