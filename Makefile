PACKAGE = sogo-connector
GIT_REV = $(shell git rev-parse --verify HEAD | cut -c1-10)

#ifeq ($(shell uname),Darwin)
#VERSION = $(shell grep em:version install.rdf | sed -E 's@(em:version=|"| )@@g')
#else
#VERSION = $(shell grep em:version install.rdf | sed -e 's@\(em:version=\|\"\|\ \)@@g')
#endif
VERSION=68.0.0

XPI_ARCHIVE = $(PACKAGE)-$(VERSION)-$(GIT_REV).xpi

SHELL=bash
ZIP=zip

FILENAMES = $(shell cat MANIFEST)

all: MANIFEST-pre MANIFEST rest

MANIFEST: MANIFEST-pre
	@if ! cmp MANIFEST MANIFEST-pre >& /dev/null; then \
	  mv -f MANIFEST-pre MANIFEST; \
	  echo MANIFEST updated; \
	else \
	  rm -f MANIFEST-pre; \
	fi;

MANIFEST-pre:
#	@echo install.rdf > $@
	@echo manifest.json > $@
	@echo COPYING >> $@
	@echo ChangeLog.old >> $@
	@find . -type f -name "*.manifest" >> $@
	@find . -type f -name "*.xul" >> $@
	@find . -type f -name "*.xml" >> $@
	@find . -type f -name "*.dtd" >> $@
	@find . -type f -name "*.idl" >> $@
	@find . -type f -name "*.js" >> $@
	@find . -type f -name "*.jsm" >> $@
	@find . -type f -name "*.css" >> $@
	@find . -type f -name "*.png" >> $@
	@find . -type f -name "*.gif" >> $@
	@find . -type f -name "*.jpg" >> $@
	@find . -type f -name "*.xpt" >> $@
	@find . -type f -name "*.properties" >> $@
	@find . -type f -name "*.rdf" >> $@
	@find . -type f -name "RELEASE-NOTES" >> $@	

rest: MANIFEST
	@+make $(XPI_ARCHIVE)

$(XPI_ARCHIVE): $(FILENAMES)
	@echo Generating $(XPI_ARCHIVE)...
	@rm -f $(XPI_ARCHIVE)
	@$(ZIP) -9r $(XPI_ARCHIVE) $(FILENAMES) > /dev/null

clean:
	rm -f MANIFEST-pre $(XPI_ARCHIVE)
	rm -f *.xpi
	find . -name "*~" -exec rm -f {} \;

distclean: clean
	rm -f MANIFEST
