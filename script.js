function previewFile() {
    const fileInput = document.getElementById("imageUpload");
    const defaultImage = document.querySelector(".default-image");
    const previewImage = document.getElementById("previewImage");
    const fileNameDisplay = document.getElementById("fileName");

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            defaultImage.style.display = "none"; // Ẩn ảnh mặc định
            previewImage.src = e.target.result;
            previewImage.style.display = "block"; // Hiển thị ảnh người dùng chọn
        };
        reader.readAsDataURL(fileInput.files[0]);
        fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
        defaultImage.style.display = "block"; // Hiện ảnh mặc định
        previewImage.style.display = "none";
        fileNameDisplay.textContent = "No file chosen";
    }
}

async function submitImage() {
    const fileInput = document.getElementById("imageUpload");
    const loader = document.getElementById("loader"); // Get loader element
    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append("queryImage", fileInput.files[0]);

        loader.style.display = "block"; // Show loader
        document.querySelector(".submit-btn").disabled = true; // Disable submit button

        try {
            const response = await fetch("/api/search", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Server error" }));
                alert(`Error: ${response.status} - ${errorData.message || "Could not process image."}`);
                return;
            }

            const results = await response.json();
            displayResults(results);
        } catch (error) {
            console.error("Error submitting image:", error);
            alert("An error occurred while submitting the image. Check the console for details.");
        } finally {
            loader.style.display = "none"; // Hide loader
            document.querySelector(".submit-btn").disabled = false; // Enable submit button
        }
    } else {
        alert("Please choose a file first!");
    }
}

function displayResults(results) {
    // Clear previous results
    const existingResultsContainer = document.getElementById("resultsContainer");
    if (existingResultsContainer) {
        existingResultsContainer.remove();
    }

    const container = document.createElement("div");
    container.id = "resultsContainer";
    container.className = "results-container"; // Add a class for styling

    if (results && results.length > 0) {
        const title = document.createElement("h2");
        title.textContent = "Top Results:";
        container.appendChild(title);

        const ul = document.createElement("ul");
        ul.className = "results-list"; // Add a class for styling

        results.forEach((result) => {
            const li = document.createElement("li");
            li.className = "result-item"; // Add a class for styling

            const img = document.createElement("img");
            // Use the filepath directly as it's already relative to public/
            img.src = result.filepath; 
            img.alt = result.filepath;
            img.style.width = "100px"; // Basic styling
            img.style.height = "100px";
            img.style.objectFit = "cover";

            li.appendChild(img);
            ul.appendChild(li);
        });
        container.appendChild(ul);
    } else {
        const noResultsText = document.createElement("p");
        noResultsText.textContent = "No similar images found.";
        container.appendChild(noResultsText);
    }

    // Append to the right section or a specific part of your HTML
    const rightSection = document.querySelector(".right-section");
    if (rightSection) {
        rightSection.appendChild(container);
    } else {
        document.body.appendChild(container); // Fallback if .right-section is not found
    }
}