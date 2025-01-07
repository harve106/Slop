package main

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func sendMessage(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for cross-origin requests
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		return
	}

	// Parse the incoming JSON message
	var messageData struct {
		Username string `json:"username"`
		Message  string `json:"message"`
		Group    string `json:"group"`
	}

	if err := json.NewDecoder(r.Body).Decode(&messageData); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// First, let's find any existing chat files with these users
	participants := strings.Split(messageData.Group, "_")
	existingFilePath := ""

	// List all files in the messages directory
	files, err := filepath.Glob("./html/messages/*.html")
	if err == nil {
		// For each file, check if it contains all participants
		for _, file := range files {
			// Extract filename without path and extension
			filename := filepath.Base(file)
			filename = strings.TrimSuffix(filename, ".html")

			// Split filename into users
			fileUsers := strings.Split(filename, "_")

			// Check if length matches
			if len(fileUsers) != len(participants) {
				continue
			}

			// Check if all participants are in this file
			allFound := true
			for _, participant := range participants {
				found := false
				for _, fileUser := range fileUsers {
					if fileUser == participant {
						found = true
						break
					}
				}
				if !found {
					allFound = false
					break
				}
			}

			if allFound {
				existingFilePath = file
				break
			}
		}
	}

	// Determine which file path to use
	filePath := existingFilePath
	if filePath == "" {
		filePath = fmt.Sprintf("./html/messages/%s.html", messageData.Group)
	}

	// Create directories if they don't exist
	os.MkdirAll("./html/messages", 0755)

	// Check if file exists and create with HTML template if it doesn't
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		initialHTML := `<!DOCTYPE html>
<html>
<head>
    <title>Chat Messages</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .message { 
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            background-color: #f0f0f0;
        }
        .username {
            font-weight: bold;
            color: #2c5282;
            margin-bottom: 5px;
        }
        .content {
            color: #4a5568;
            line-height: 1.5;
        }
    </style>
</head>
<body>
`
		if err := os.WriteFile(filePath, []byte(initialHTML), 0644); err != nil {
			http.Error(w, "Failed to create message file", http.StatusInternalServerError)
			return
		}
	}

	// Create the new message HTML
	messageHTML := fmt.Sprintf(`
<div class="message">
    <div class="username">%s</div>
    <div class="content">%s</div>
</div>
`, html.EscapeString(messageData.Username), html.EscapeString(messageData.Message))

	// Append the message to the file
	file, err := os.OpenFile(filePath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		http.Error(w, "Failed to open message file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	if _, err := file.WriteString(messageHTML); err != nil {
		http.Error(w, "Failed to write message", http.StatusInternalServerError)
		return
	}

	// Send success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "message received",
	})
}
