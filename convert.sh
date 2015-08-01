#!/bin/bash

current_dir="$PWD"
input_dir="/faust/img/tif"
#output_jpg="/var/www/release/transcript/facsimile/jpg"
#output_tiles="/var/www/release/transcript/facsimile/jpg_tiles"
#output_metadata="/var/www/release/transcript/facsimile/metadata"
output_jpg="/faust/transcript/facsimile/jpg"
output_tiles="/faust/transcript/facsimile/jpg_tiles"
output_metadata="/faust/transcript/facsimile/metadata"
#zoom_levels must be larger than 0
zoom_levels="8"
tile_width="256"
tile_height="256"

# go to input dir to explore files and folders
cd "$input_dir"
find . -type d > "$current_dir/temp_input_folders.txt"

# create output folder structure. it shall mimic the input folder structure
mkdir -p "$output_jpg"
cd "$output_jpg"
xargs mkdir -p < "$current_dir/temp_input_folders.txt"
mkdir -p "$output_tiles"
cd "$output_tiles"
xargs mkdir -p < "$current_dir/temp_input_folders.txt"
mkdir -p "$output_metadata"
cd "$output_metadata"
xargs mkdir -p < "$current_dir/temp_input_folders.txt"
rm "$current_dir/temp_input_folders.txt"

#   create jpg and scaled jpg
# first find all *.tga files
# then sed filenames to absolute path of input and output file
# next create a convert-command and execute it (start conversion tga->jpg)
# finally create scaled jpg
cd "$input_dir"
find . -type f -name "*.tif" -print0 | while IFS= read -r -d '' file
do
  #convert tga->jpg and create preview images with max size 240x360 (widthXheight)
  out_file1=$(echo "$file" | sed "s#^\.#"$input_dir"#" )
  out_file2=$(echo "$file" | sed "s#^\.#"$output_jpg"#;s/\.tif$/_0\.jpg/" )
  out_file3=$(echo "$file" | sed "s#^\.#"$output_jpg"#;s/\.tif$/_preview\.jpg/" )
  cmd="convert ${out_file1}[0] -strip $out_file2"
  echo "running: $cmd"
  convert "${out_file1}"[0] -strip "${out_file2}"
  convert "${out_file1}"[0] -strip -resize 240x360 "${out_file3}"


  #create json metadata
  echo "           creating json metadata"
  json_file=$(echo "$file" | sed "s#^\.#"$output_metadata"#;s/\.tif$/\.json/" )
  image_width=$(identify $file 2>/dev/null | sed -n '1 p' | cut -d\   -f3 | cut -dx -f1)
  image_height=$(identify $file 2>/dev/null | sed -n '1 p' | cut -d\   -f3 | cut -dx -f2)
  printf "{\n  \"imageWidth\": %s,\n  \"imageHeight\": %s,\n  \"tileWidth\": %s,\n  \"tileHeight\": %s,\n  \"zoomLevels\": %s\n}" ${image_width} ${image_height} ${tile_width} ${tile_height} ${zoom_levels}  > "${json_file}"

  #scale images
  echo "           creating scaled images"
  for i in `seq 0 $((zoom_levels-1))`
  do
    scaled_file1=$(echo "$out_file2" | sed "s/[0-9]\.jpg/$i\.jpg/" )
    scaled_file2=$(echo "$out_file2" | sed "s/[0-9]\.jpg/$((i+1))\.jpg/" )
    cmd="convert $scaled_file1 -thumbnail 50% $scaled_file2"
#    echo "         $cmd"
    convert "${scaled_file1}" -thumbnail 50% "${scaled_file2}"
  done

  #create tiles
  echo "           creating tiles"
  for i in `seq 0 ${zoom_levels}`
  do
    scaled_file=$(echo "$scaled_file1" | sed "s/[0-9]\.jpg/$i\.jpg/" )
    tiled_file=$(echo "$scaled_file" | sed "s/\.jpg/_%\[filename:tile\]\.jpg/;s#"$output_jpg"#"$output_tiles"#" )
    cmd="convert $scaled_file -strip -crop ${tile_width}x${tile_height} -set filename:tile %[fx:page.x/${tile_width}]_%[fx:page.y/${tile_height}] +repage +adjoin $tiled_file"
#    echo "         $cmd"
    convert "${scaled_file}" -strip -crop ${tile_width}x${tile_height} -set filename:tile %[fx:page.x/${tile_width}]_%[fx:page.y/${tile_height}] +repage +adjoin "${tiled_file}"
  done
done

# return to the folder that we started in
cd "$current_dir"


