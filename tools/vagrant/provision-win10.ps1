Invoke-WebRequest https://chocolatey.org/install.ps1 -UseBasicParsing | Invoke-Expression
choco install -y -r --no-progress anaconda3 --params '"/AddToPath"'
choco install -y -r --no-progress microsoft-visual-cpp-build-tools
choco install -y -r --no-progress git

#echo "### Installing the branch version of rsconnect-jupyter"
#cd C:\vagrant
#C:\Python37\python.exe setup.py build install
#C:\Python37\Scripts\jupyter-nbextension.exe install --symlink --user --py rsconnect_jupyter
#C:\Python37\Scripts\jupyter-nbextension.exe enable rsconnect_jupyter --user --py
#C:\Python37\Scripts\jupyter-serverextension.exe enable --py rsconnect_jupyter

echo "### To start jupyter notebook, execute C:\Python37\Scripts\jupyter-notebook.exe"
