#!/usr/bin/env bash

unset CDPATH;
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )";

########################################################################
#
# shutdown ()
#
# signal handler, kills jobs and exits
#
########################################################################

function shutdown () {
    echo "Received SIGINT or SIGTERM. Shutting down $DAEMON"

    # Set TERM
    kill -SIGTERM "${PID}"

    # Wait for exit
    wait "${PID}"

    # All done.
    echo "Done."
}

########################################################################
#
# print_help ()
#
# print the help message
#
########################################################################

function print_help() {

    cat << EOF
usage: $( basename $0 ) [options]

Check if Selenium Grid and Connect server are running.

OPTIONS:

-c <connect-url>                URL of the Connect Server
-g <grid-url>                   URL of the Selenium Grid
-h                              Print this help message.
-j <jupyter-url>                URL of the Jupyter Notebook Server
-l <dir>                        Directory for log files
-n <nodes>                      Number of Selenium Grid Nodes to check for

EOF
    exit $?
}


# setup signal trapping
# shutdown if we get the following signals
trap shutdown SIGINT SIGTERM

# setup reasonable defaults for command line options
connect_url="http://mock-connect:5000"
jupyter_url="http://jupyter-py3.8:9999"
grid_url="http://selenium-hub:4444"
logdir="./"
grid_nodes="2"

# parse the command line flags and options
# separate flags from options

options=":c:g:hj:l:n:";

let nNamedArgs=0;
let nUnnamedArgs=0;
while (( "$#" ))
do
    case $1 in
        -h )
            namedArgs[$nNamedArgs]=$1;
            let nNamedArgs++;
            shift;
            ;;
        -c | -g | -j | -l |-n )
            namedArgs[$nNamedArgs]=$1;
            let nNamedArgs++;
            shift;
            namedArgs[$nNamedArgs]=$1;
            let nNamedArgs++;
            shift;
            ;;
        * )
            # unrecognized options
            unnamedArgs[$nUnnamedArgs]=$1;
            let nUnnamedArgs++;
            shift;
            ;;
    esac
done

while getopts "${options}" Option "${namedArgs[@]}"
do
   case $Option in
      c ) connect_url=$OPTARG;;
      g ) grid_url=$OPTARG;;
      h ) print_help;;
      j ) jupyter_url=$OPTARG;;
      l ) logdir=$OPTARG;;
      n ) grid_nodes=$OPTARG;;
   esac
done

set -e

gridstat_log="${logdir}/gridstat.log"
connectstat_log="${logdir}/connectstat.log"
jupyterstat_log="${logdir}/jupyterstat.log"

gridstat_cmd="${DIR}/tools/systemstat/gridstat \
    --verbose \
    --stdout \
    --url '${grid_url}' \
    --nodes ${grid_nodes} \
    --logfile ${gridstat_log}"

connectstat_cmd="${DIR}/tools/systemstat/sutstat \
    --verbose \
    --stdout \
    --url '${connect_url}' \
    --logfile ${connectstat_log}"

jupyterstat_cmd="${DIR}/tools/systemstat/sutstat \
    --verbose \
    --stdout \
    --url '${jupyter_url}' \
    --logfile ${jupyterstat_log}"

# run the command
eval "${gridstat_cmd} && ${connectstat_cmd} && ${jupyterstat_cmd}" &

# Track the command through its PID
PID="$!"

# wait for the command to complete
wait "${PID}" && exit $?
