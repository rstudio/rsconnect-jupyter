FROM jupyterhub/jupyterhub:3

# Install Jupyter and the rsconnect-jupyter extension
RUN python3 -m pip install jupyter rsconnect-jupyter

# Enables the rsconnect-jupyter extension
RUN python3 -m jupyter nbextension install --sys-prefix --py rsconnect_jupyter
RUN python3 -m jupyter nbextension enable --sys-prefix --py rsconnect_jupyter
RUN python3 -m jupyter serverextension enable --sys-prefix --py rsconnect_jupyter

# Create a new user called "username" with the password "password"
#
# Use these credentials when logging into JupyterHub.
#
# Example:
#     username: "username"
#     password: "password"
RUN useradd -m -p $(openssl passwd -1 password) -s /bin/sh username

ENTRYPOINT ["jupyterhub"]
