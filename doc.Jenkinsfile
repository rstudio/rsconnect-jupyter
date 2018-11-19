pipeline {
    agent { node('docker') }
    parameters {
        string(name: 'RELEASE_VERSION', description: 'The release version (maj.min.patch.build) to promote.')
        booleanParam(name: 'S3_SYNC', description: 'When checked, push artifacts to S3')
    }
    stages {
        stage('Check Parameters') {
            when {
                expression { return params.RELEASE_VERSION == "" }
            }
            steps {
                error "You need to specify a release version to promote."
            }
        }
        stage('Promote Docs (Dry Run)') {
            when {
                allOf {
                    expression { return !params.S3_SYNC }
                    expression { return params.RELEASE_VERSION != "" }
                }
            }
            steps {
                sh "aws cp s3://rstudio-rsconnect-jupyter/rsconnect-jupyter-${RELEASE_VERSION}.html s3://docs.rstudio.com/rsconnect-jupyter/ --dryrun"
                sh "aws cp s3://docs.rstudio.com/rsconnect-jupyter/rsconnect-jupyter-${RELEASE_VERSION}.html s3://docs.rstudio.com/rsconnect-jupyter/index.html --dryrun"
            }
        }
        stage('Promote Docs') {
            when {
                allOf {
                    expression { return params.S3_SYNC }
                    expression { return params.RELEASE_VERSION != "" }
                }
            }
            steps {
                sh "aws cp s3://rstudio-rsconnect-jupyter/rsconnect-jupyter-${RELEASE_VERSION}.html s3://docs.rstudio.com/rsconnect-jupyter/ --dryrun"
                sh "aws cp s3://docs.rstudio.com/rsconnect-jupyter/rsconnect-jupyter-${RELEASE_VERSION}.html s3://docs.rstudio.com/rsconnect-jupyter/index.html --dryrun"
            }
        }
    }
}
