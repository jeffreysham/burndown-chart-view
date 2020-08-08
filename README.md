## Overview
This is the "Burndown Chart" Monday app. 
<br>It can be used as a board view and render data from the board using settings.

## Run the project

In the project directory, you should run:

### `npm install`

And then to run an application with automatic virtual ngrok tunnel, run:

### `npm start`

Visit http://localhost:4040/status and under "command_line section" find the URL. This is the public URL of your app, so you can use it to test it.

## Configure Monday App 

1. Open monday.com, login to your account and go to a "Developers" section.
2. Create a new "Burndown Chart Example App"
3. Open "OAuth & Permissions" section and add "boards:read" and "me:read" scopes
4. Open "Features" section and create a new "Boards View" feature
5. Open "View setup" tab and fulfill in "Custom URL" field your ngrok public URL, which you got previously (f.e. https://021eb6330099.ngrok.io)
6. Click "Boards" button and choose one of the boards with some data in it.
7. Click "Preview button"
8. Enjoy the Burndown Chart app!

## Install Monday App

The app can be installed by going to the following link https://auth.monday.com/oauth2/authorize?client_id=25cf176f96b23181755559a9348a7294&response_type=install