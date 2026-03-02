CREATE TABLE `conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`youtubeUrl` varchar(512) NOT NULL,
	`videoTitle` varchar(255),
	`videoId` varchar(64),
	`duration` int,
	`fileSize` int,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`downloadUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversions_id` PRIMARY KEY(`id`)
);
