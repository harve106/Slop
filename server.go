package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	fmt.Println("Starting SLOP (SLack Over Powered): an open source slack clone")

	// Create new router
	router := mux.NewRouter()

	// Create file servers
	htmlHandler := http.FileServer(http.Dir("./html"))
	router.PathPrefix("/html/").Handler(htmlHandler)

	// API routes with auth middleware
	apiRouter := router.PathPrefix("/api/v1").Subrouter()

	apiRouter.HandleFunc("/sendMessage", sendMessage).Methods("POST", "OPTIONS")

	// Default route for index.html
	router.PathPrefix("/").Handler(htmlHandler)

	// Build URL and start server
	port := 9090
	url := fmt.Sprintf("%s:%d", "0.0.0.0", port)
	fmt.Printf("\x1B[35m Listening on http://%s\n", url)

	log.Fatal(http.ListenAndServe(url, router))
}
