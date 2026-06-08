# SPDX-License-Identifier: CC0-1.0
# SPDX-FileCopyrightText: No rights reserved
NAME = context-window-title
UUID = $(NAME)@erikis.github.io

build: clean
	mkdir -p build
	cd src && gnome-extensions pack -f \
	  --schema="../schemas/org.gnome.shell.extensions.$(NAME).gschema.xml" \
	  --extra-source=../LICENSE \
	  --extra-source=../metadata.json \
	  --extra-source=../resources/ui \
	  --extra-source=../resources/icons \
	  --extra-source=./widgets \
	  --extra-source=./preferences \
	  --podir=../po \
	  -o ../build

clean:
	rm -rf build

remove:
	rm -rf $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

install: build remove
	gnome-extensions install -f build/$(UUID).shell-extension.zip

strings:
	# Generate .pot file using strings in source files
	find . \( -path "./resources/ui/*.ui" -o -path "./src/*.js" \) \
	-printf "%p\n" | LC_ALL=C sort | \
	xargs xgettext --output="po/$(UUID).pot" --add-comments --from-code=utf-8 \
	--package-name="$(UUID)"

languages:
	# Based on current .pot file, create/update .po files for languages in po/LINGUAS
	cd po && while IFS= read -r lang; do \
	  case "$$lang" in \
	    [a-z]*) \
	      msginit --no-translator --locale="$$lang" \
	      --input "$(UUID).pot" -o "$${lang}.po_fresh"; \
	      if [ -f "$${lang}.po" ]; \
	      then \
	        msgmerge -N "$${lang}.po" "$${lang}.po_fresh" > "$${lang}.po_merged"; \
	        rm "$${lang}.po_fresh" && mv "$${lang}.po_merged" "$${lang}.po"; \
	      else \
	        mv "$${lang}.po_fresh" "$${lang}.po"; \
	      fi ;; \
	  esac \
	done < LINGUAS

eslint:
	npm exec eslint -- src

prettier:
	npm exec prettier -- src --check

