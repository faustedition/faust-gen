import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

import org.gradle.api.tasks.Copy

class CopyWithSymlink extends Copy {
    public CopyWithSymlink() {
        super();
        eachFile { details ->
            Path sourcePath = FileSystems.getDefault().getPath(details.file.path)
            if(Files.isSymbolicLink(sourcePath)) {
                details.exclude()
                Path destinationPath = Paths.get("${destinationDir}/${details.relativePath}")
                if(Files.notExists(destinationPath.parent)) {
                    project.mkdir destinationPath.parent
                }
                project.exec {
                    commandLine 'ln', '-sf', Files.readSymbolicLink(sourcePath), destinationPath
                }
            }
        }
    }
}
