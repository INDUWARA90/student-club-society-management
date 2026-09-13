package com.club.backend;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		loadDotEnvIntoSystemProperties();
		SpringApplication.run(BackendApplication.class, args);
	}

	/**
	 * Loads a .env file (if present in the working directory) into system properties, so
	 * ${VAR} placeholders in application.yml resolve for local runs outside Docker (which
	 * supplies its own env vars via docker-compose's env_file). Real OS env vars always
	 * take precedence — this only fills gaps.
	 */
	private static void loadDotEnvIntoSystemProperties() {
		Path envFile = Path.of(".env");
		if (!Files.exists(envFile)) {
			return;
		}

		List<String> lines;
		try {
			lines = Files.readAllLines(envFile);
		} catch (IOException e) {
			throw new IllegalStateException("Failed to read .env file", e);
		}

		for (String line : lines) {
			String trimmed = line.trim();
			if (trimmed.isEmpty() || trimmed.startsWith("#")) {
				continue;
			}
			int separatorIndex = trimmed.indexOf('=');
			if (separatorIndex <= 0) {
				continue;
			}
			String key = trimmed.substring(0, separatorIndex).trim();
			String value = trimmed.substring(separatorIndex + 1).trim();
			if (System.getenv(key) == null && System.getProperty(key) == null) {
				System.setProperty(key, value);
			}
		}
	}
}
