#!/usr/bin/env bash
# Builds submission/demo-30s.mp4 (30 s, 1280x720) from real captures of the app.
# Needs: ffmpeg with libass and drawtext. Run from the repo root: bash submission/build_video.sh
#
# What the video is: real screenshots of the running app (see video-assets/), real audio rendered by
# app/sound/render_backup.mjs from the real Mauritius story, and the English subtitles in demo-30s.srt
# burned in. It is NOT a screen recording with a person. There is no voice and no tester in it,
# so nothing in it claims a blind user took part.
set -euo pipefail
A=submission/video-assets
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
OUT=submission/demo-30s.mp4

# Picture: 0-5 title card, 5-10 Musical, 10-15 Strict, 15-21 the gap, 21-23.5 answer, 23.5-26 refusal, 26-30 end card.
# Sound:   0-5 Side A (steps 1-10), 5-10 Side A (steps 11-20), 10-15 Side B (steps 11-20),
#          15-21 Side B (steps 1-12: the click runs through the real gap at step 2), 21-30 silence.
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -t 5   -i "color=c=black:s=1280x720:r=25" \
  -loop 1 -t 5    -i $A/1-musical.png \
  -loop 1 -t 5    -i $A/2-strict.png \
  -loop 1 -t 6    -i $A/3-gap.png \
  -loop 1 -t 2.5  -i $A/4-answer.png \
  -loop 1 -t 2.5  -i $A/5-refusal.png \
  -f lavfi -t 4   -i "color=c=black:s=1280x720:r=25" \
  -i $A/real-sideA.wav -i $A/real-sideB.wav \
  -filter_complex "
    [0:v]drawtext=fontfile=$FONT:text='Earth, Out Loud':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2-30,
         drawtext=fontfile=$FONT:text='NASA sea surface temperature around Mauritius, as sound':fontcolor=0xbbbbbb:fontsize=30:x=(w-text_w)/2:y=(h/2)+40[v0];
    [1:v]scale=1138:640,pad=1280:720:(ow-iw)/2:0:black,setsar=1,fps=25[v1];
    [2:v]scale=1138:640,pad=1280:720:(ow-iw)/2:0:black,setsar=1,fps=25[v2];
    [3:v]scale=1138:640,pad=1280:720:(ow-iw)/2:0:black,setsar=1,fps=25[v3];
    [4:v]scale=1138:640,pad=1280:720:(ow-iw)/2:0:black,setsar=1,fps=25[v4];
    [5:v]scale=1138:640,pad=1280:720:(ow-iw)/2:0:black,setsar=1,fps=25[v5];
    [6:v]drawtext=fontfile=$FONT:text='Data\: NASA GIBS, JPL MUR MEaSUREs (doi\:10.5067/GHGMR-4FJ04)':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=230,
         drawtext=fontfile=$FONT:text='Not yet tested with blind users.':fontcolor=0xffd479:fontsize=34:x=(w-text_w)/2:y=310[v6];
    [v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0,
      subtitles=submission/demo-30s.srt:force_style='FontName=DejaVu Sans,FontSize=11,Alignment=2,MarginV=14,Outline=1,Shadow=0,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=1'[v];
    [7:a]atrim=0:5,asetpts=PTS-STARTPTS[a1];
    [7:a]atrim=5:10,asetpts=PTS-STARTPTS[a2];
    [8:a]atrim=5:10,asetpts=PTS-STARTPTS[a3];
    [8:a]atrim=0:6,asetpts=PTS-STARTPTS[a4];
    aevalsrc=0:d=9:s=22050[a5];
    [a1][a2][a3][a4][a5]concat=n=5:v=0:a=1[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 23 -c:a aac -b:a 128k -t 30 $OUT
ffprobe -v error -show_entries format=duration,size -of default=nw=1 $OUT
